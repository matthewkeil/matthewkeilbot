import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

export interface DnsStackProps extends cdk.StackProps {
  hostedZoneId: string;
  hostedZoneName: string;
  /** The AWS account ID that will assume the delegation role (compute account) */
  computeAccountId: string;
  /** Optional: ALB DNS name to create the A record (can be added later via separate deployment) */
  albDnsName?: string;
  /** Optional: ALB hosted zone ID for alias record */
  albHostedZoneId?: string;
  /** The subdomain for the bot (e.g., "bot" for bot.matthewkeil.com) */
  subdomain?: string;
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
      albDnsName,
      albHostedZoneId,
      subdomain = "bot",
    } = props;

    // Import the existing hosted zone
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId,
      zoneName: hostedZoneName,
    });

    // Create a role that can be assumed by the compute account
    // This role allows the compute account to:
    // 1. Create DNS records for ACM certificate validation
    // 2. Create the A record pointing to the ALB
    this.delegationRole = new iam.Role(this, "DnsDelegationRole", {
      roleName: `matthewkeilbot-dns-delegation-${this.region}`,
      assumedBy: new iam.AccountPrincipal(computeAccountId),
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

    // Also need permission to get change status
    this.delegationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["route53:GetChange"],
        resources: ["arn:aws:route53:::change/*"],
      })
    );

    // If ALB DNS name is provided, create the A record directly
    // This is useful for updating DNS after the compute stack is deployed
    if (albDnsName && albHostedZoneId) {
      new route53.ARecord(this, "AlbAliasRecord", {
        zone: this.hostedZone,
        recordName: `${subdomain}.${hostedZoneName}`,
        target: route53.RecordTarget.fromAlias({
          bind: () => ({
            dnsName: albDnsName,
            hostedZoneId: albHostedZoneId,
          }),
        }),
      });

      new cdk.CfnOutput(this, "BotUrl", {
        value: `https://${subdomain}.${hostedZoneName}`,
        description: "matthewkeilbot URL",
      });
    }

    // Outputs
    new cdk.CfnOutput(this, "DelegationRoleArn", {
      value: this.delegationRole.roleArn,
      description: "ARN of the DNS delegation role (use this in compute stack)",
      exportName: "MatthewkeilbotDnsDelegationRoleArn",
    });

    new cdk.CfnOutput(this, "HostedZoneId", {
      value: hostedZoneId,
      description: "Route53 Hosted Zone ID",
      exportName: "MatthewkeilbotHostedZoneId",
    });

    new cdk.CfnOutput(this, "HostedZoneName", {
      value: hostedZoneName,
      description: "Route53 Hosted Zone Name",
      exportName: "MatthewkeilbotHostedZoneName",
    });
  }
}
