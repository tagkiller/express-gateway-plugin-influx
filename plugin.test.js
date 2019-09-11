const axios = require('axios').default;
const path = require('path');
const gateway = require('express-gateway');
const express = require('express');

let Application = undefined;
let Collector = undefined;
let axiosInstance = undefined;

beforeAll( async (done) => {
  axiosInstance = axios.create({
    baseURL: 'http://localhost:14268/',
    validateStatus: (status) => status < 400,
  });

  const app = express();
  const collector = express()
  const hello = (req, res) => res.status(200).send('Hello!');

  app.get('/status/:code', (req, res) => res.sendStatus(req.params.code));
  app.get('/src/js/*', hello);
  app.get('/api/v1/*', hello);

  collector.post('/api/trace', (req, res) => res.sendStatus(req.params.code));

  Application = await app.listen(8081);
  Collector = await app.listen(14268);
  done();

});

afterAll((done) => {
  Application.close(done);
  Collector.close(done);
});

describe('Route path', () => {
  it('should receive trace', () => {
    return axiosInstance.post('/api/v1/device/stb123456/esn', { foo: 'bar' }).then()
  });
});