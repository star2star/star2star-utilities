"use strict";
const request = require('request-promise');
const config = require('./config.json');

/**
* This function will get the endPoint from the config file
*
* @param env - environment to use default to prod
* @param microservice - name of the microservice to getEndpoint
* @return string - microservice uri base on parameters or undefined 
*/
const getEndpoint = (env="prod", microservice="NOTHING") =>{
  const upperMS = microservice.toUpperCase();
  const validEnvs = ['dev', 'test', 'stage', 'prod'];

  if (validEnvs.indexOf(env) === -1){
    console.error(`Env is invalid: ${env}; not one of ${validEnvs}; setting to prod`);
    env = validEnvs[3];
  }

  return config[upperMS] ? config[upperMS][env] : undefined;
}

/**
 * This function will retrieve the conversation uuid for whom you are sending it to
 * @param apiKey - cpaas api key
 * @param userUUID - the user uuid making the request
 * @param toPhoneNumber - a single string full phone number you will be sending the sms too
 * @return promise which will resolve to conversation uuid
 */
const getConvesationUUID = (apiKey, userUUID, toPhoneNumber ) => {
  return new Promise((resolve, reject)=>{
    const GET_CONVERSATION_CMD = `/users/${userUUID}/conversations`;
    const MS = getEndpoint(process.env.NODE_ENV, "Messaging");
    const REQUEST_OPTIONS = {
      method: 'POST',
      uri: `${MS}${GET_CONVERSATION_CMD}`,
      body: {"phone_numbers":[toPhoneNumber]},
      headers: {
                'Content-Type': 'application/json',
                'application-key':`${apiKey}`
                },
      json: true
    }

    //console.log('RRRR:', REQUEST_OPTIONS)
    request(REQUEST_OPTIONS).then((response)=>{
        //console.log('rrrr', response.context.uuid)
        resolve(response.context.uuid);
    }).catch((fetchError)=>{
      // something went wrong so
      //console.log('fetch error: ', fetchError)
      reject(fetchError);
    });
  }); // end promise
} // end function getConversation UUID

/**
 * This function will send an sms message
 * @param apiKey - cpaas api key
 * @param conversationUUID - uuid of conversation; see getConvesationUUID
 * @param userUUID - the user uuid making the request
 * @param fromPhoneNumber - full phone number to use as the sender/reply too
 * @param msg - the message to send
 * @return promise which will resolve to  the response
 */
const sendSMSMessage = (apiKey, convesationUUID, userUUID,  fromPhoneNumber, msg ) =>{
  return new Promise((resolve, reject)=>{
    const SEND_MSG_CMD = `/users/${userUUID}/messages`;
    const OBJ_BODY = {
        "to": `${convesationUUID}`,
        "from": `${fromPhoneNumber}`,
        "channel": "sms",
        "content": [{
            "type": "text",
            "body": `${msg}`
          }]
      };
    const MS = getEndpoint(process.env.NODE_ENV, "Messaging");

    const REQUEST_OPTIONS = {
      method: 'POST',
      uri: `${MS}${SEND_MSG_CMD}`,
      body: OBJ_BODY,
      headers: {
                'Content-Type': 'application/json',
                'application-key': apiKey
                },
      json: true
    };

    request(REQUEST_OPTIONS).then((response)=>{
      //console.log('xxxxx', response)
      resolve(response);
    }).catch((e)=>{
      //console.log(e)
      reject(`sendSMSMessage errored: ${e}`);
    });

  })
}

/**
 * This function will send an sms message
 * @param apiKey - cpaas api key
 * @param userUUID - the user uuid making the request
 * @param msg - the message to send
 * @param fromPhoneNumber - full phone number to use as the sender/reply too
 * @param toPhoneNumber - a single string full phone number you will be sending the sms too
 * @return promise which will resolve to  the response
 */
const sendSMS = (apiKey, userUUID, msg, fromPhoneNumber, toPhoneNumber ) =>{
  return new Promise((resolve, reject)=>{
      getConvesationUUID(apiKey, userUUID, toPhoneNumber).then((conversationUUID)=>{
        sendSMSMessage(apiKey, conversationUUID, userUUID, fromPhoneNumber, msg).then((response)=>{
          resolve(response);
        }).catch((sError)=>{
          reject(sError);
        });
      }).catch((cError)=>{
        //console.log('EEEEE:', cError)
        reject(cError);
      });
  });
};

/**
 * This function will get user sms number
 * @param apiKey - cpaas api key
 * @param userUUID - the user uuid making the request
 * @return promise which will resolve to  the sms number or reject if empty
 */
const getSMSNumber = (apiKey, userUUID) =>{

  return new Promise((resolve, reject)=>{
      const MS = getEndpoint(process.env.NODE_ENV, "identity");

      const SMS_REQ_OPTIONS = {
          method: 'GET',
          uri: `${MS}/identities/${userUUID}`,
          headers: {
              'application-key': apiKey,
              'Content-type': 'application/json'
          },
          json: true
      };
      request(SMS_REQ_OPTIONS).then((r) => {
        if (r && r.aliases){
          const smsNbr = r.aliases.reduce((prev, curr)=>{
            if (!prev){
              if (curr && curr.hasOwnProperty('sms')){
                return curr['sms'];
              }
            }
            return prev;
          }, undefined)
          if (smsNbr){
            resolve(smsNbr)
          } else {
            reject();
          }
        } else {
          reject();
        }
      }).catch((e)=>{
        reject();
      });
  });
}

/**
* This function will call the identity microservice with the credentials and
* api key you passed in
* @param apiKey - api key for cpaas systems
* @param email - email address for an star2star account
* @param pwd - passowrd for that account
* @returns promise resolving to an identity data
**/
const getIdentity = (apiKey='null api key', email='null email', pwd='null pwd')=>{
  const MS = getEndpoint(process.env.NODE_ENV, "identity");
  const requestOptions = {
    method: 'POST',
    uri: `${MS}/users/login`,
    headers: {
        'application-key': apiKey,
        'Content-type': 'application/json'
    },
    body: {
      "email": email,
      "password": pwd
    },
    json: true
  };

  return request(requestOptions);
}


/**
* This function will ask the cpaas data object service for a specific
* type of object
*
* @param apiKey - api key for cpaas systems
* @param userUUID - user UUID to be used
* @param identityJWT - identity JWT
* @param dataObjectType - data object type to be retrieved; default: dataObjectType
* @param loadContent - string boolean if the call should also return content of object; default false
* @returns promise resolving to an array of data objects
**/
const getDataObjectByType = (apiKey='null api key', userUUID='null user uuid', identityJWT='null jwt',
                              dataObjectType='data_object', loadContent='false' ) => {
  const MS = getEndpoint(process.env.NODE_ENV, "objects");
  const requestOptions = {
      method: 'GET',
      uri: `${MS}/objects?type=${dataObjectType}&load_content=${loadContent}`,
      headers: {
          'application-key': apiKey,
          'Content-type': 'application/json',
          'X-User-uuid': userUUID,
          'Authorization': `Bearer ${identityJWT}`
      },
      json: true
  };
  return request(requestOptions);
}

/**
* This function will ask the cpaas data object service for a specific object
*
* @param apiKey - api key for cpaas systems
* @param userUUID - user UUID to be used
* @param identityJWT - identity JWT
* @param dataObjectUUID - data object UUID
* @returns data
**/
const getDataObject = (apiKey='null api key', userUUID='null user uuid', identityJWT='null jwt',
                              dataObjectUUID='null uuid' ) => {
  const MS = getEndpoint(process.env.NODE_ENV, "objects");
  const requestOptions = {
      method: 'GET',
      uri: `${MS}/objects/${dataObjectUUID}`,
      headers: {
          'application-key': apiKey,
          'Content-type': 'application/json',
          'Authorization': `Bearer ${identityJWT}`
      },
      json: true
  };
  return request(requestOptions);
}

/**
* This function will ask the cpaas data object service for a specific object
*
* @param apiKey - api key for cpaas systems
* @param lambdaName - string representing the lambda name
* @param params - json object of parameters to be passed to the lambda function
* @returns promise
**/
const invokeLambda = (apiKey='null api key', lambdaName='not defined', params={} ) => {
  const MS = getEndpoint(process.env.NODE_ENV, "lambda");
  const requestOptions = {
      method: 'POST',
      uri: `${MS}/actions/${lambdaName}/invoke`,
      headers: {
          'application-key': apiKey,
          'Content-Type': 'application/json'
      },
      body: params,
      json: true
  };
  return request(requestOptions);
}

/**
 * This function will lookup static items to be replaced
 * @param matchString - the string that we are matching on
 * @return value or undefined - will return you the string value or undefined
 */
const replaceStaticValues = (matchString) => {
  const aValues = {
    'datetime': new Date()
  };
  return aValues[matchString];
}

/**
 * This function will get the value from the object tree; recursive
 * @param matchString - the string that we are matching on
 * @param objectTree - the json object to search
 * @return value or undefined - will return you the string value or undefined
 */
const getValueFromObjectTree = (matchString="", objectTree={}) => {

  const mString = matchString.replace(/%/g, '');
  const sValue = replaceStaticValues(mString);
  if (sValue){
    return sValue;
  }
  let xReturn;
  //console.log('---', mString, matchString, objectTree)
  if (Object.keys(objectTree).indexOf(mString) > -1){
    //console.log('rrrr', matchString, objectTree[mString])
    xReturn =  objectTree[mString];
  } else {

    xReturn =  Object.keys(objectTree).reduce((p, c, i, a)=>{
      if (p === undefined) {
        //console.log(p)
        if (typeof(objectTree[c]) === 'object'){
          return getValueFromObjectTree(mString, objectTree[c]);
        }
      }
      return p;

    }, undefined);
  }
  //console.log('bbbb', matchString, xReturn)
  return xReturn;
}

/**
* This function will find variables in the inputValue %<text>%
* and replace them from the value from the objectTree
* returning to you the new string
*
* @param inputValue - string that contains variables
* @param objectTree - json object to search
* @returns string
**/
const replaceVariables = (inputValue="", objectTree={}) => {
  // will search for %xxxxx%
  const myRegex =  /(\%[\w|\d|\.\-\*\/]+\%)/g;
  let returnString = inputValue;

  const arrayOfMatches = inputValue.match(myRegex);

  arrayOfMatches !== null && arrayOfMatches.forEach((theMatch)=>{
    const retrievedValue =  getValueFromObjectTree(theMatch, objectTree);
    //console.log('^^^^^^^^', theMatch, retrievedValue)
    returnString = returnString.replace(theMatch, retrievedValue ? retrievedValue : theMatch );
  });

  return returnString;
}

module.exports = {config, getSMSNumber, sendSMS, getIdentity, getDataObjectByType, getDataObject, replaceVariables, getValueFromObjectTree, invokeLambda, getEndpoint };
