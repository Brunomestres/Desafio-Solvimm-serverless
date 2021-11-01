"use strict";
const { v4: uuidv4 } = require("uuid");
const { extname } = require('path');
const AWS = require("aws-sdk"); // eslint-disable-line import/no-extraneous-dependencies
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();
module.exports.extractMetadata = async (event) => {
  const { key, size } = event.Records[0].s3.object;
  const [,name] = key.split("/");
  let params = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      s3objectkey: uuidv4(),
      info: {
        key: key,
        name: name,
        size: size,
      },
    },
  };
  await dynamoDb.put(params).promise();
};

module.exports.getMetadata = async (event) => {
  const { s3objectkey } = event.pathParameters;
  let params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      s3objectkey,
    },
  };

  const image = await dynamoDb.get(params).promise();
  const response = {
    statusCode: 200,
    body: JSON.stringify(image),
  };

  return response;
};

module.exports.getImage = async (event) => {
  const { s3objectkey } = event.pathParameters;
  let paramsDynamo = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      s3objectkey,
    },
  };
  const { Item } = await dynamoDb.get(paramsDynamo).promise();
  const { key, name } = Item.info;

  let paramsBucket = {
    Bucket: process.env.bucket,
    Key: key,
  };
  const { Body } = await S3.getObject(paramsBucket).promise();

  const buf = Buffer.from(Body);
  const response =  {
    "statusCode": 200,
    "headers": {
      "Content-Type": "image/*",
      "Content-Disposition": `attachment; filename=${name}`,
    },
    "body": buf.toString("base64"),
    "isBase64Encoded": true 
  };

  return response;
};
module.exports.infoImage = async (event, context, callback) => {
  let paramsDynamo = {
    TableName: process.env.DYNAMODB_TABLE,
  };
  const { Items } = await dynamoDb.scan(paramsDynamo).promise();
  //Pegando a maoir imagem 
  const bigger = Items.reduce((a , b ) => (a.info.size > b.info.size) ? a : b );
  //Pegando a menor imagem 
  const smaller = Items.reduce((a , b ) => (a.info.size < b.info.size) ? a : b );
  const extensios = Items.map(item => extname(item.info.key));
  //Array filtrando as extensões repetidas
  const extFilter = [... new Set(extensios)];
  //Array contando as extensões repetidas
  const countExt = extensios.reduce((object, item) => {
    if(!object[item]){
      object[item] = 1;
    }else{
      object[item]++;
    }
    return object;
  },{})
  const response = {
    "Infos": {
      "Imagem maior": bigger.info.name,
      "Imagem menor": smaller.info.name,
      "Tipos de imagem": extFilter,
      "Quantidades de tipos": countExt,

    }
  }
  return { 
    "statusCode": 200,
    "body": JSON.stringify(response)
  }
}