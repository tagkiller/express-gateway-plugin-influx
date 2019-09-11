# express-gateway-plugin-influx
A simple Influx Client plugin for Express Gateway.

## Installation

Simply copy/paste :

`eg plugin install express-gateway-plugin-influx`

## Usage

Here is an example of how to use the plugin :

```
...
pipelines:
  default:
    policies:
      - influx:
          - action:
              measurement: request_duration
              influxdbSchema:
                host: localhost
                database: api_gw_requests
                port: 8082
...
```

## Configuration available

- `measurement` : (string) 'Measurement name'
- `influxdbSchema`
    - `host`: (string) 'The HTTP endpoint when using the remote sampler (default: localhost)'
    - `port`: (number) 'The http port (default: 8086)'
    - `protocol`: (string) 'http/https ... (default: http)'
    - `database`: (string) 'Database in which to send the data'
    - `username`: (string) 'Username to connect to the database (default: root)'
    - `password`: (string) 'Password to connect to the database (default: root)'

