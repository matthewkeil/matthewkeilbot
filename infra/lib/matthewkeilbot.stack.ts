import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as elbv2Targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export interface MatthewkeilbotStackProps extends cdk.StackProps {
  domainName?: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
  instanceType?: string;
  keyPairName?: string;
}

export class MatthewkeilbotStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: MatthewkeilbotStackProps = {}) {
    super(scope, id, props);

    const { domainName, hostedZoneId, hostedZoneName, instanceType = "t2.micro", keyPairName } = props;

    // Use default VPC for simplicity (can be customized later)
    const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", {
      isDefault: true,
    });

    // Security group for EC2 instance
    const instanceSg = new ec2.SecurityGroup(this, "InstanceSg", {
      vpc,
      description: "Security group for matthewkeilbot EC2 instance",
      allowAllOutbound: true,
    });

    // Allow SSH from anywhere (restrict in production!)
    instanceSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "Allow SSH");

    // Security group for ALB
    const albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc,
      description: "Security group for matthewkeilbot ALB",
      allowAllOutbound: true,
    });

    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTPS");
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP for redirect");

    // Allow ALB to reach instance on OpenClaw port
    instanceSg.addIngressRule(albSg, ec2.Port.tcp(18789), "Allow ALB to OpenClaw gateway on 18789");

    // IAM role for EC2 instance
    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "Role for matthewkeilbot EC2 instance",
      managedPolicies: [
        // SSM Session Manager access (optional but useful)
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    // Allow reading SSM parameters under /matthewkeilbot/
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/matthewkeilbot/*`],
      })
    );

    // Create SSM parameters for secrets (placeholders - set actual values via AWS console or CLI)
    new ssm.StringParameter(this, "TelegramBotToken", {
      parameterName: "/matthewkeilbot/telegram/bot-token",
      stringValue: "PLACEHOLDER_SET_VIA_CLI",
      description: "Telegram bot token for matthewkeilbot",
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, "AnthropicApiKey", {
      parameterName: "/matthewkeilbot/anthropic/api-key",
      stringValue: "PLACEHOLDER_SET_VIA_CLI",
      description: "Anthropic API key for matthewkeilbot",
      tier: ssm.ParameterTier.STANDARD,
    });

    // User data script to bootstrap the instance
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "#!/bin/bash",
      "set -e",
      "",
      "# Update system",
      "apt-get update && apt-get upgrade -y",
      "",
      "# Install Docker",
      "apt-get install -y apt-transport-https ca-certificates curl software-properties-common",
      "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg",
      'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null',
      "apt-get update",
      "apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin",
      "",
      "# Start Docker",
      "systemctl start docker",
      "systemctl enable docker",
      "",
      "# Add ubuntu user to docker group",
      "usermod -aG docker ubuntu",
      "",
      "# Install AWS CLI v2",
      "curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscliv2.zip",
      "apt-get install -y unzip",
      "unzip -q /tmp/awscliv2.zip -d /tmp",
      "/tmp/aws/install",
      "rm -rf /tmp/aws /tmp/awscliv2.zip",
      "",
      "# Create matthewkeilbot directory",
      "mkdir -p /opt/matthewkeilbot",
      "chown ubuntu:ubuntu /opt/matthewkeilbot",
      "",
      "# Signal that bootstrap is complete",
      'echo "Bootstrap complete" > /opt/matthewkeilbot/bootstrap-complete'
    );

    // Latest Ubuntu 24.04 LTS AMI
    const machineImage = ec2.MachineImage.lookup({
      name: "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*",
      owners: ["099720109477"], // Canonical
    });

    // EC2 Instance
    this.instance = new ec2.Instance(this, "Instance", {
      vpc,
      instanceType: new ec2.InstanceType(instanceType),
      machineImage,
      securityGroup: instanceSg,
      role: instanceRole,
      userData,
      userDataCausesReplacement: true,
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: ec2.BlockDeviceVolume.ebs(20, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
      ...(keyPairName && {
        keyPair: ec2.KeyPair.fromKeyPairName(this, "KeyPair", keyPairName),
      }),
    });

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
    });

    // Target group for EC2 instance
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      port: 18789,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: "/",
        healthyHttpCodes: "200-399",
        interval: cdk.Duration.seconds(30),
      },
    });

    targetGroup.addTarget(new elbv2Targets.InstanceTarget(this.instance, 18789));

    // HTTPS listener (if domain is configured)
    if (domainName && hostedZoneId && hostedZoneName) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
        hostedZoneId,
        zoneName: hostedZoneName,
      });

      // ACM Certificate
      const certificate = new acm.Certificate(this, "Certificate", {
        domainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });

      // HTTPS listener
      this.alb.addListener("HttpsListener", {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificates: [certificate],
        defaultTargetGroups: [targetGroup],
      });

      // HTTP to HTTPS redirect
      this.alb.addListener("HttpListener", {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: "HTTPS",
          port: "443",
          permanent: true,
        }),
      });

      // Route53 alias record
      new route53.ARecord(this, "AliasRecord", {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(this.alb)),
      });

      new cdk.CfnOutput(this, "Url", {
        value: `https://${domainName}`,
        description: "matthewkeilbot URL",
      });
    } else {
      // HTTP only listener (for testing without domain)
      this.alb.addListener("HttpListener", {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultTargetGroups: [targetGroup],
      });

      new cdk.CfnOutput(this, "Url", {
        value: `http://${this.alb.loadBalancerDnsName}`,
        description: "matthewkeilbot URL (HTTP only - configure domain for HTTPS)",
      });
    }

    // Outputs
    new cdk.CfnOutput(this, "InstanceId", {
      value: this.instance.instanceId,
      description: "EC2 Instance ID",
    });

    new cdk.CfnOutput(this, "InstancePublicIp", {
      value: this.instance.instancePublicIp,
      description: "EC2 Instance Public IP (for SSH)",
    });

    new cdk.CfnOutput(this, "AlbDnsName", {
      value: this.alb.loadBalancerDnsName,
      description: "ALB DNS Name",
    });

    new cdk.CfnOutput(this, "SshCommand", {
      value: keyPairName
        ? `ssh -i ~/.ssh/${keyPairName}.pem ubuntu@${this.instance.instancePublicIp}`
        : `ssh ubuntu@${this.instance.instancePublicIp}`,
      description: "SSH command to connect to instance",
    });
  }
}
