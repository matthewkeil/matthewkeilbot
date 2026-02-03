import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

export interface DnsStackProps extends cdk.StackProps {
  hostedZoneId: string;
  hostedZoneName: string;
  /** The AWS account ID that will assume the delegation role (compute account) */
  computeAccountId: string;
  /** The subdomain for the bot (e.g., "bot" for bot.matthewkeil.com) */
  subdomain?: string;
  /** Elastic IP address of the EC2 instance (from MatthewkeilbotStack) */
  elasticIp?: string;
  /** External ID for assuming the delegation role (adds extra security layer) */
  externalId?: string;
}

export class DnsStack extends cdk.Stack {
  public readonly delegationRole: iam.Role;
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const {
      hostedZoneId,
      hostedZoneName,
      computeAccountId,
      subdomain = "bot",
      elasticIp,
      externalId = "matthewkeilbot-dns-delegation",
    } = props;

    // Import the existing hosted zone
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId,
      zoneName: hostedZoneName,
    });

    // Create a role that can be assumed by the compute account
    // Uses external ID to prevent confused deputy attacks
    this.delegationRole = new iam.Role(this, "DnsDelegationRole", {
      roleName: `matthewkeilbot-dns-delegation-${this.region}`,
      assumedBy: new iam.AccountPrincipal(computeAccountId),
      externalIds: [externalId],
      description: "Role for matthewkeilbot compute account to manage DNS records",
    });

    // Grant permissions to manage Route53 records in this hosted zone
    this.delegationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "route53:GetHostedZone",
          "route53:ChangeResourceRecordSets",
          "route53:ListResourceRecordSets",
        ],
        resources: [`arn:aws:route53:::hostedzone/${hostedZoneId}`],
      })
    );

    this.delegationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["route53:GetChange"],
        resources: ["arn:aws:route53:::change/*"],
      })
    );

    // Create A record pointing to the Elastic IP (if provided)
    if (elasticIp) {
      new route53.ARecord(this, "BotARecord", {
        zone: this.hostedZone,
        recordName: `${subdomain}.${hostedZoneName}`,
        target: route53.RecordTarget.fromIpAddresses(elasticIp),
        ttl: cdk.Duration.minutes(5),
      });

      new cdk.CfnOutput(this, "BotUrl", {
        value: `https://${subdomain}.${hostedZoneName}`,
        description: "matthewkeilbot URL",
      });
    }

    // Outputs
    new cdk.CfnOutput(this, "DelegationRoleArn", {
      value: this.delegationRole.roleArn,
      description: "ARN of the DNS delegation role",
      exportName: "MatthewkeilbotDnsDelegationRoleArn",
    });

    new cdk.CfnOutput(this, "DelegationRoleExternalId", {
      value: externalId,
      description: "External ID required when assuming the delegation role",
    });

    new cdk.CfnOutput(this, "HostedZoneIdOutput", {
      value: hostedZoneId,
      description: "Route53 Hosted Zone ID",
    });

    new cdk.CfnOutput(this, "RecordName", {
      value: `${subdomain}.${hostedZoneName}`,
      description: "DNS record name to create",
    });
  }
}
