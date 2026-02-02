#!/usr/bin/env node
/**
 * matthewkeilbot CDK Application
 *
 * This CDK app deploys OpenClaw to AWS with cross-account DNS support.
 * There are two stacks that can be deployed independently or together.
 *
 * ============================================================================
 * STACKS
 * ============================================================================
 *
 * DnsStack (deploy to Route53 account)
 *   Creates:
 *   - IAM delegation role for cross-account DNS operations
 *   - A record pointing to the ALB (requires albDnsName and albHostedZoneId)
 *
 * MatthewkeilbotStack (deploy to compute account)
 *   Creates:
 *   - EC2 instance running OpenClaw
 *   - Application Load Balancer
 *   - ACM Certificate (with cross-account DNS validation)
 *   - SSM Parameters for secrets
 *
 * ============================================================================
 * REQUIRED CONTEXT PARAMETERS
 * ============================================================================
 *
 * For DnsStack:
 *   -c dnsAccountId=111111111111        AWS account ID for Route53
 *   -c computeAccountId=222222222222    AWS account ID for compute resources
 *   -c hostedZoneId=Z1234567890ABC      Route53 hosted zone ID
 *   -c hostedZoneName=example.com       Route53 hosted zone name
 *
 * For MatthewkeilbotStack:
 *   -c computeAccountId=222222222222    AWS account ID for compute resources
 *   -c hostedZoneId=Z1234567890ABC      Route53 hosted zone ID
 *   -c hostedZoneName=example.com       Route53 hosted zone name
 *   -c domainName=bot.example.com       Full domain name for the bot
 *   -c dnsDelegationRoleArn=arn:...     ARN of delegation role (from DnsStack)
 *
 * ============================================================================
 * OPTIONAL CONTEXT PARAMETERS
 * ============================================================================
 *
 *   -c subdomain=bot                    Subdomain prefix (default: "bot")
 *   -c instanceType=t2.micro            EC2 instance type (default: "t2.micro")
 *   -c keyPairName=matthewkeilbot       SSH key pair name
 *   -c region=us-east-1                 AWS region (default: "us-east-1")
 *   -c albDnsName=...                   ALB DNS name (for DnsStack A record)
 *   -c albHostedZoneId=...              ALB hosted zone ID (for DnsStack A record)
 *
 * ============================================================================
 * DEPLOYMENT EXAMPLES
 * ============================================================================
 *
 * Step 1: Deploy DnsStack first (creates delegation role)
 *
 *   cdk deploy DnsStack --profile dns-account \
 *     -c dnsAccountId=111111111111 \
 *     -c computeAccountId=222222222222 \
 *     -c hostedZoneId=Z1234567890ABC \
 *     -c hostedZoneName=matthewkeil.com
 *
 * Step 2: Deploy MatthewkeilbotStack (uses delegation role for cert validation)
 *
 *   cdk deploy MatthewkeilbotStack --profile compute-account \
 *     -c computeAccountId=222222222222 \
 *     -c domainName=bot.matthewkeil.com \
 *     -c hostedZoneId=Z1234567890ABC \
 *     -c hostedZoneName=matthewkeil.com \
 *     -c dnsDelegationRoleArn=arn:aws:iam::111111111111:role/matthewkeilbot-dns-delegation-us-east-1 \
 *     -c keyPairName=matthewkeilbot
 *
 * Step 3: Re-deploy DnsStack with ALB outputs (creates A record)
 *
 *   cdk deploy DnsStack --profile dns-account \
 *     -c dnsAccountId=111111111111 \
 *     -c computeAccountId=222222222222 \
 *     -c hostedZoneId=Z1234567890ABC \
 *     -c hostedZoneName=matthewkeil.com \
 *     -c albDnsName=<ALB_DNS_NAME_FROM_STEP_2> \
 *     -c albHostedZoneId=<ALB_HOSTED_ZONE_ID_FROM_STEP_2>
 *
 * Deploy both stacks together (after initial setup):
 *
 *   cdk deploy --all \
 *     -c dnsAccountId=111111111111 \
 *     -c computeAccountId=222222222222 \
 *     -c hostedZoneId=Z1234567890ABC \
 *     -c hostedZoneName=matthewkeil.com \
 *     -c domainName=bot.matthewkeil.com \
 *     -c dnsDelegationRoleArn=arn:aws:iam::111111111111:role/matthewkeilbot-dns-delegation-us-east-1 \
 *     -c keyPairName=matthewkeilbot
 *
 * ============================================================================
 */

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MatthewkeilbotStack } from "../lib/matthewkeilbot.stack";
import { DnsStack } from "../lib/dns-stack";

const app = new cdk.App();

// Configuration from context
const dnsAccountId = app.node.tryGetContext("dnsAccountId") as string | undefined;
const computeAccountId = app.node.tryGetContext("computeAccountId") as string | undefined;
const hostedZoneId = app.node.tryGetContext("hostedZoneId") as string | undefined;
const hostedZoneName = app.node.tryGetContext("hostedZoneName") as string | undefined;
const domainName = app.node.tryGetContext("domainName") as string | undefined;
const subdomain = (app.node.tryGetContext("subdomain") as string) || "bot";
const instanceType = (app.node.tryGetContext("instanceType") as string) || "t2.micro";
const keyPairName = app.node.tryGetContext("keyPairName") as string | undefined;
const region =
  (app.node.tryGetContext("region") as string) || process.env.CDK_DEFAULT_REGION || "us-east-1";

// ALB details (provided after first deployment of compute stack)
const albDnsName = app.node.tryGetContext("albDnsName") as string | undefined;
const albHostedZoneId = app.node.tryGetContext("albHostedZoneId") as string | undefined;

// DNS delegation role ARN (provided after first deployment of DNS stack)
const dnsDelegationRoleArn = app.node.tryGetContext("dnsDelegationRoleArn") as string | undefined;

/**
 * Validation helper - throws if required parameters are missing
 */
function requireContext(params: Record<string, unknown>, stackName: string): void {
  const missing = Object.entries(params)
    .filter(([, value]) => value === undefined || value === "")
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required context parameters for ${stackName}: ${missing.join(", ")}\n` +
        `Provide them with: ${missing.map((k) => `-c ${k}=<value>`).join(" ")}`
    );
  }
}

// Determine which stacks to create based on provided context
const createDnsStack = dnsAccountId !== undefined;
const createComputeStack = computeAccountId !== undefined;

if (!createDnsStack && !createComputeStack) {
  throw new Error(
    "No stacks to deploy. Provide at least one of:\n" +
      "  -c dnsAccountId=<account_id>     (for DnsStack)\n" +
      "  -c computeAccountId=<account_id> (for MatthewkeilbotStack)"
  );
}

// Create DnsStack if dnsAccountId is provided
if (createDnsStack) {
  requireContext(
    {
      dnsAccountId,
      computeAccountId,
      hostedZoneId,
      hostedZoneName,
    },
    "DnsStack"
  );

  new DnsStack(app, "DnsStack", {
    env: {
      account: dnsAccountId,
      region,
    },
    hostedZoneId: hostedZoneId!,
    hostedZoneName: hostedZoneName!,
    computeAccountId: computeAccountId!,
    subdomain,
    albDnsName,
    albHostedZoneId,
  });
}

// Create MatthewkeilbotStack if computeAccountId is provided
if (createComputeStack) {
  requireContext(
    {
      computeAccountId,
      hostedZoneId,
      hostedZoneName,
      domainName,
      dnsDelegationRoleArn,
    },
    "MatthewkeilbotStack"
  );

  new MatthewkeilbotStack(app, "MatthewkeilbotStack", {
    env: {
      account: computeAccountId,
      region,
    },
    domainName,
    hostedZoneId,
    hostedZoneName,
    dnsDelegationRoleArn,
    instanceType,
    keyPairName,
  });
}
