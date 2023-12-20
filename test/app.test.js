import supertest from 'supertest'
import chai from 'chai'
import chaiHttp from 'chai-http'
import app from '../service.js'
const expect = chai.expect

chai.use(chaiHttp)

describe('First Test Group', function () {
  it('Check 1+1', function () {
    expect(1+1).to.equal(2)
  })
})

describe('Express App', function () {
  it('Should return status 200 for GET /', function (done) {
    chai.request('http://localhost:3000') // replace with your app's address
      .get('/')
      .end(function (err, res) {
        expect(err).to.be.null
        expect(res).to.have.status(200)
        done()
      })
  })
})

describe('Scan Routes', function () {
  it('Should respond to POST /start with required fields', function (done) {
    supertest(app)
      .post('/start')
      .send({
        collectionSlug: 'testSlug',
        margin: 0.3,
        increment: 0.01,
        schema: 'erc721',
        token: '0'
      })
      .expect(200)
      .end(function (err, res) {
        expect(err).to.be.null
        expect(res.text).to.equal('Added testSlug-0 to scan queue')
        done()
      })
  })
})