// @ts-check
/// <reference path="./node_modules/express-gateway/index.d.ts" />
const Influx = require('influx');
const logger = require('express-gateway/lib/logger').gateway;

function getDurationInMilliseconds(start) {
  const NS_PER_SEC = 1e9
  const NS_TO_MS = 1e6
  const diff = process.hrtime(start)

  return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS
}

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
          removeIdsRegex: {
            type: 'string',
            description: 'Regex to use to match ids to remove from the path tag',
            default: '([0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12})|([0-9]+)',
          },
          removeIds: {
            type: 'boolean',
            description: 'Whether to remove Ids from the path that are sent to metrics or not (default: false)',
            default: false,
          },
          bufferSize: {
            type: 'number',
            description: 'The size to match before sending the data to influx',
            default: 100,
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
        const buffer = [];
        const removeIdsRegex = new RegExp(actionParams.removeIdsRegex, 'g');
        const influx = new Influx.InfluxDB({
          ...actionParams.influxdbSchema,
        });
        let timeoutId = null;
        function write() {
          influx.writePoints(buffer).then(
            () => {
              buffer.length = 0;
              logger
              .info(
                `metrics sent to ${actionParams.influxdbSchema.host}:${actionParams.influxdbSchema.port}/${actionParams.influxdbSchema.database} - application : ${actionParams.application}`
              );
            }
          ).catch(logger.error);
        }
        function writePoint(start, req, res) {
          const duration = getDurationInMilliseconds(start);
          const path = actionParams.removeIds ? req.path.replace(removeIdsRegex, '_id_') : req.path;

          buffer.push({
            timestamp: new Date().setTime(start),
            measurement: actionParams.measurement,
            tags: {
              path: path,
              host: req.hostname,
              verb: req.method,
              status: res.statusCode,
              application: actionParams.application,
            },
            fields: { duration: isNaN(duration) ? 0 : duration },
          });
          if (buffer.length >= actionParams.bufferSize) {
            timeoutId && clearTimeout(timeoutId);
            timeoutId = null;
            write();
          } else if (!timeoutId) {
            timeoutId = setTimeout(write, 1000);
          }
        };
        function removeListeners(res) {
            res.removeListener('finish', writePoint);
            res.removeListener('error', removeListeners);
            res.removeListener('close', removeListeners);
        }

        return (req, res, next) => {
          const start = process.hrtime();
          // Look at the following doc for the list of events : https://nodejs.org/api/http.html
          res.once('finish', () => writePoint(start, req, res));
          res.once('error', () => removeListeners(res));
          res.once('close', () => removeListeners(res));
          if (next) next();
        }
      },
    });
  }
};

module.exports = plugin;