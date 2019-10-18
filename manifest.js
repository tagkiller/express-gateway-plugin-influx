// @ts-check
/// <reference path="./node_modules/express-gateway/index.d.ts" />
const Influx = require('influx');
const logger = require('express-gateway/lib/logger').gateway;
const uuidOrIdRegex = /\/([\da-fA-F]{8}\-[\da-fA-F]{4}\-[\da-fA-F]{4}\-[\da-fA-F]{4}\-[\da-fA-F]{12})|(\d+)\//g

const plugin = {
  version: '1.0.0',
  policies: ['influx'],

  init: pluginContext => {
    pluginContext.registerPolicy({
      name: 'influx',
      schema: {
        $id: 'http://express-gateway.io/schemas/policies/influx.json',
        type: 'object',
        properties: {
          measurement: {
            type: 'string',
            description: 'Measurement name',
            default: 'requests',
          },
          application: {
            type: 'string',
            description: 'The name of the application that you monitor (default: default)',
            default: 'default',
          },
          removeIds: {
            type: 'boolean',
            description: 'Whether to remove Ids from the path that are sent to metrics or not (default: false)',
            default: false,
          },
          influxdbSchema: {
            type: 'object',
            properties: {
              host: {
                type: 'string',
                description: 'The HTTP endpoint when using the remote sampler (default: localhost)',
                default: 'localhost',
              },
              port: {
                type: 'number',
                description: 'The http port (default: 8086)',
                default: 8086,
              },
              protocol: {
                type: 'string',
                description: 'http/https ... (default: http)',
                default: 'http',
              },
              database: {
                type: 'string',
                description: 'Database in which to send the data'
              },
              username: {
                type: 'string',
                description: 'Username to connect to the database (default: root)',
                default: 'root',
              },
              password: {
                type: 'string',
                description: 'Password to connect to the database (default: root)',
                default: 'root',
              },
            },
          },
        },
      },
      policy: (actionParams) => {
        logger.debug(`configuring influx client with the following parameters : ${JSON.stringify(actionParams.influxdbSchema)}`)
        const influx = new Influx.InfluxDB({
          ...actionParams.influxdbSchema,
        });

        return (req, res, next) => {
          const start = Date.now();
          function writePoint() {
            const duration = Date.now() - start;
            const path = actionParams.removeIds ? req.path.replace(uuidOrIdRegex, '/_id_/') : req.path;
            influx.writePoints([{
              measurement: actionParams.measurement,
              tags: {
                path: path,
                host: req.hostname,
                verb: req.method,
                status: res.statusCode,
                application: actionParams.application,
              },
              fields: {
                duration: isNaN(duration) ? 0 : duration,
              },
            }]).then(
              () => {
                logger
                .info(
                  `metrics sent to ${actionParams.influxdbSchema.host}:${actionParams.influxdbSchema.port}/${actionParams.influxdbSchema.database} - application : ${actionParams.application}`
                );
              }
            ).catch(logger.error);
          };
          // Look at the following doc for the list of events : https://nodejs.org/api/http.html
          function removeListeners() {
            res.removeListener('finish', writePoint);
            res.removeListener('error', removeListeners);
            res.removeListener('close', removeListeners);
          };
          res.once('finish', writePoint);
          res.once('error', removeListeners);
          res.once('close', removeListeners);
          if (next) next();
        }
      },
    });
  }
};

module.exports = plugin;