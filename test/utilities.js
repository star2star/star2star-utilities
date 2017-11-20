var assert = require('assert');
var util = require('../index');
var config = require('../config.json');
var fs = require('fs');


var creds = {
  CPAAS_KEY: "yourkeyhere",
  email: 'email@email.com',
  password: 'pwd',
  isValid: false
}

beforeEach(function(){
  process.env.NODE_ENV = 'dev';
  // file system uses full path so will do it like this
  if (fs.existsSync('./test/credentials.json')) {
    // do not need test folder here
    creds = require('./credentials.json');
  }


});

describe('utilities', function() {
  it('Get Identity with Good Credentials', function(done) {
    if (!creds.isValid) return done();
    util.getIdentity(creds.CPAAS_KEY, creds.email, creds.password).then((identityData)=>{
      assert(identityData !== null )
      done();
    })
  });
  it('Get Identity with Bad Credentials', function(done) {
    if (!creds.isValid) return done();
    util.getIdentity(creds.CPAAS_KEY, creds.email, 'bad').catch((identityData)=>{
      //console.log('---- %j', identityData)
      assert(identityData.statusCode === 401)
      done();
    })
  });


  it('Valid SMS Number', function(done) {
    if (!creds.isValid) return done();
    util.getSMSNumber(creds.CPAAS_KEY,  "0904f8d5-627f-4ff5-b34d-68dc96487b1e").then((sms)=>{
      assert(sms === '+19414441241')
      done();
    })
  });
  it('Invalid USER UUID', function(done) {
    if (!creds.isValid) return done();
    util.getSMSNumber(creds.CPAAS_KEY,  "bad").catch(()=>{
      assert(true)
      done();
    })
  });
  it('Send SMS', function(done) {
      if (!creds.isValid) return done();
      util.sendSMS(creds.CPAAS_KEY, "0904f8d5-627f-4ff5-b34d-68dc96487b1e", "msg", "+19414441241", "+19418076677" ).then((x)=>{
        //console.log(`sms sent: ${JSON.stringify(x)}`);
        assert(x.content[0].body === 'msg')
        done();
      }).catch((z)=>{
        //console.log(z)
        assert(false)
        done();
      })

  });
  it('All Notify DO With Good Credentials', function(done) {
    if (!creds.isValid) return done();
    util.getIdentity(creds.CPAAS_KEY, creds.email, creds.password).then((identityData)=>{
      util.getDataObjectByType(creds.CPAAS_KEY, identityData.user_uuid, identityData.token,
        'all_notify_data_object', false).then((responseData)=>{
          console.log(identityData.token)
          //console.log(responseData)
        assert(responseData.content !== null )
        done();
      })
    })
  });

  it('replace variables', function(done) {
    const newString = util.replaceVariables('%foo%', {'foo': 1});
    assert(newString === "1" )
    done();
  });

  it('replace variables missing', function(done) {
    const newString = util.replaceVariables('%foobar%', {'foo': 1});
    assert.equal(newString, '%foobar%' )
    done();
  });

  it('replace variables nested', function(done) {
    const newString = util.replaceVariables('%foobar%', {'foo': 1, 'bar':{'foobar': 'value'}});
    assert.equal(newString, 'value' )
    done();
  });

  it('replace variables multiple', function(done) {
    const x = "now is the %time.1% for all %attribute-1% now %DUDE% was %Date1% could also be %diet_food%  how about %a/b% but not %/james%";
    const mValue = 'now is the timeOne for all attributeOne now dude was dateOne could also be dietFood  how about aDividedb but not slashJames';
    const ot = {
      'time.1':'timeOne',
      '/james': 'slashJames',
      'a':{
        'diet_food': 'dietFood',
        'b':{
          'attribute-1': 'attributeOne',
          'a/b': 'aDividedb'
        }
      },
      'DUDE': 'dude',
      'Date1': 'dateOne'
    };

    const newString = util.replaceVariables(x, ot);
    assert.equal(newString, mValue )
    done();
  });

  it('replace variables multiple one missing', function(done) {
    const x = "now is the %time.1% for %missing% all %attribute-1% now %DUDE% was %Date1% could also be %diet_food%  how about %a/b% but not %/james%";
    const mValue = 'now is the timeOne for %missing% all attributeOne now dude was dateOne could also be dietFood  how about aDividedb but not slashJames';
    const ot = {
      'time.1':'timeOne',
      '/james': 'slashJames',
      'a':{
        'diet_food': 'dietFood',
        'b':{
          'attribute-1': 'attributeOne',
          'a/b': 'aDividedb'
        }
      },
      'DUDE': 'dude',
      'Date1': 'dateOne'
    };

    const newString = util.replaceVariables(x, ot);
    assert.equal(newString, mValue )
    done();
  });

  it('invoke good lambda', function(done) {
    if (!creds.isValid) return done();
    const params = {'a':1};
    params.env = process.env.NODE_ENV;
    util.invokeLambda(creds.CPAAS_KEY,  "abc", params).then((lambdaResponse)=>{
      //console.log(lambdaResponse)
      const validResponse = { message: 'abc successfully finished', parameters: params };
      assert.deepEqual(lambdaResponse, validResponse)
      done();
    })
  });

  it('invoke default-all-notify lambda', function(done) {
    if (!creds.isValid) return done();
    const params = {"params":{"title":"911: ","body":"Called from zone: SRQ Main extension: Room 2701 at Thu Nov 16 2017 16:10:19 GMT+0000 (UTC) ","contacts":[{"uuid":"1","name":"James","communication_modalities":[{"type":"sms","value":"+19418076677"}]}]},"cfg":{"_outDataSamples":["5a0db856818133001743490d"],"_selectedDataSamples":[],"_account":"59fcdca30f014f001733fda1","CPAAS_KEY":"588a5e9bf5612d00d8eb7df1e29a4b390b1448a66324533c29dce7ec","email":"jschimmoeller@schimmoeller.net","password":"2017star"},"config":config,"env":  "dev" };

    util.invokeLambda(creds.CPAAS_KEY,  "default-all-notify", params).then((lambdaResponse)=>{
      console.log('=======', lambdaResponse)
      const validResponse = 'sms successfully finished';
      assert.deepEqual(lambdaResponse.message, validResponse)
      done();
    }).catch((e)=>{
      console.log('-----', e);
      assert(false);
      done();
    })
  });

  it('invoke bad lambda', function(done) {
    if (!creds.isValid) return done();
    util.invokeLambda(creds.CPAAS_KEY,  "this one does not exists", {"env": "dev"}).catch((lambdaResponse)=>{
      //console.log(lambdaResponse)
      assert.equal(lambdaResponse.statusCode, 404)
      done();
    })
  });

  it('test getEndpoint valid - dev', function(done){
    const prodEndPoint = util.getEndpoint("dev", 'IDENTITY');
    assert.equal("https://cpaas.star2star.net/identity", prodEndPoint);
    done();
  });

  it('test getEndpoint valid - test ', function(done){
    const prodEndPoint = util.getEndpoint("test", 'IDENTITY');
    assert.equal("https://cpaas.star2star.net/identity", prodEndPoint);
    done();
  });

  it('test getEndpoint valid - prod ', function(done){
    const prodEndPoint = util.getEndpoint('prod', 'IDENTITY');
    assert.equal("https://cpaas.star2star.com/api/identity", prodEndPoint);
    done();
  });

  it('test getEndpoint invalid env ', function(done){
    const prodEndPoint = util.getEndpoint('foobar', 'IDENTITY');
    assert.equal("https://cpaas.star2star.com/api/identity", prodEndPoint);
    done();
  });

  it('test getEndpoint invalid service ', function(done){
    const prodEndPoint = util.getEndpoint('prod', 'foo');
    assert.equal(undefined, prodEndPoint);
    done();
  });

  it('test getEndpoint valid - lowercase ', function(done){
    const prodEndPoint = util.getEndpoint(undefined, 'identity');
    assert.equal("https://cpaas.star2star.com/api/identity", prodEndPoint);
    done();
  });
  it('config', function(done){
    const cfg = util.config
    assert.deepEqual(config, cfg);
    done();
  });
});
