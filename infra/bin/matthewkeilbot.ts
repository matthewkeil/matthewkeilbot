#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MatthewkeilbotStack } from "../lib/matthewkeilbot.stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

new MatthewkeilbotStack(app, "MatthewkeilbotStack", {
  env,
  domainName: app.node.tryGetContext("domainName"),
  hostedZoneId: app.node.tryGetContext("hostedZoneId"),
  hostedZoneName: app.node.tryGetContext("hostedZoneName"),
  instanceType: app.node.tryGetContext("instanceType") || "t2.micro",
  keyPairName: app.node.tryGetContext("keyPairName"),
});
