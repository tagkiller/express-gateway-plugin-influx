// @ts-check
/// <reference path="./node_modules/express-gateway/index.d.ts" />
const Influx = require('influx');
const logger = require('express-gateway/lib/logger').gateway;

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
            description: 'Measurement name'
          },
          influxdbSchema: {
            type: 'object',
            properties: {
              host: {
                type: 'string',
                description: 'The HTTP endpoint when using the remote sampler (default: localhost)'
              },
              port: {
                type: 'number',
                description: 'The http port (default: 8086)'
              },
              protocol: {
                type: 'string',
                description: 'http/https ... (default: http)'
              },
              database: {
                type: 'string',
                description: 'Database in which to send the data'
              },
              username: {
                type: 'string',
                description: 'Username to connect to the database (default: root)'
              },
              password: {
                type: 'string',
                description: 'Password to connect to the database (default: root)'
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
          function writePoint() {
            const duration = Date.now() - req.start;
            influx.writePoints([{
              measurement: actionParams.measurement ? actionParams.measurement : 'requests',
              tags: {
                path: req.path,
                host: req.hostname,
                verb: req.method,
                status: res.statusCode,
              },
              fields: {
                duration: isNaN(duration) ? 0 : duration,
              },
            }])
            .catch(logger.error);
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