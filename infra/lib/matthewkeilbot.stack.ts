import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export interface MatthewkeilbotStackProps extends cdk.StackProps {
  /** Full domain name for the bot (e.g., "bot.matthewkeil.com") */
  domainName: string;
  /** EC2 instance type */
  instanceType?: string;
  /** SSH key pair name */
  keyPairName?: string;
}

export class MatthewkeilbotStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly elasticIp: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: MatthewkeilbotStackProps) {
    super(scope, id, props);

    const { domainName, instanceType = "t2.micro", keyPairName } = props;

    // Use default VPC for simplicity
    const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", {
      isDefault: true,
    });

    // Security group for EC2 instance
    const instanceSg = new ec2.SecurityGroup(this, "InstanceSg", {
      vpc,
      description: "Security group for matthewkeilbot EC2 instance",
      allowAllOutbound: true,
    });

    // Allow SSH (restrict to your IP in production)
    instanceSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "Allow SSH");

    // Allow HTTPS (Caddy will handle TLS termination)
    instanceSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTPS");

    // Allow HTTP (for Let's Encrypt ACME challenge and redirect to HTTPS)
    instanceSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP");

    // IAM role for EC2 instance
    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "Role for matthewkeilbot EC2 instance",
      managedPolicies: [
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

    // Allow KMS decrypt for SSM SecureString parameters (uses AWS-managed SSM key)
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["kms:Decrypt"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "kms:ViaService": `ssm.${this.region}.amazonaws.com`,
          },
        },
      })
    );

    // CloudFormation parameters for secrets (NoEcho masks values in console)
    const telegramTokenParam = new cdk.CfnParameter(this, "TelegramBotTokenParam", {
      type: "String",
      description: "Telegram bot token for matthewkeilbot",
      noEcho: true,
    });

    const anthropicKeyParam = new cdk.CfnParameter(this, "AnthropicApiKeyParam", {
      type: "String",
      description: "Anthropic API key for matthewkeilbot",
      noEcho: true,
    });

    // Create SSM SecureString parameters using L1 construct
    new ssm.CfnParameter(this, "TelegramBotToken", {
      name: "/matthewkeilbot/telegram/bot-token",
      type: "SecureString",
      value: telegramTokenParam.valueAsString,
      description: "Telegram bot token for matthewkeilbot",
    });

    new ssm.CfnParameter(this, "AnthropicApiKey", {
      name: "/matthewkeilbot/anthropic/api-key",
      type: "SecureString",
      value: anthropicKeyParam.valueAsString,
      description: "Anthropic API key for matthewkeilbot",
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
      "# Install Caddy (reverse proxy with automatic HTTPS)",
      "apt-get install -y debian-keyring debian-archive-keyring apt-transport-https",
      "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg",
      "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list",
      "apt-get update",
      "apt-get install -y caddy",
      "",
      "# Configure Caddy for reverse proxy to OpenClaw",
      `cat > /etc/caddy/Caddyfile << 'EOF'`,
      `${domainName} {`,
      "  reverse_proxy localhost:18789",
      "}",
      "EOF",
      "",
      "# Start Caddy",
      "systemctl restart caddy",
      "systemctl enable caddy",
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
      requireImdsv2: true, // Enforce IMDSv2 to prevent SSRF attacks
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

    // Elastic IP for stable public IP address
    this.elasticIp = new ec2.CfnEIP(this, "ElasticIp", {
      domain: "vpc",
      tags: [{ key: "Name", value: "matthewkeilbot" }],
    });

    // Associate Elastic IP with the instance
    new ec2.CfnEIPAssociation(this, "ElasticIpAssociation", {
      eip: this.elasticIp.ref,
      instanceId: this.instance.instanceId,
    });

    // Outputs
    new cdk.CfnOutput(this, "InstanceId", {
      value: this.instance.instanceId,
      description: "EC2 Instance ID",
    });

    new cdk.CfnOutput(this, "ElasticIpAddress", {
      value: this.elasticIp.attrPublicIp,
      description: "Elastic IP address (use this for DNS A record)",
      exportName: "MatthewkeilbotElasticIp",
    });

    new cdk.CfnOutput(this, "Url", {
      value: `https://${domainName}`,
      description: "matthewkeilbot URL (after DNS is configured)",
    });

    new cdk.CfnOutput(this, "SshCommand", {
      value: keyPairName
        ? `ssh -i ~/.ssh/${keyPairName}.pem ubuntu@${this.elasticIp.attrPublicIp}`
        : `ssh ubuntu@${this.elasticIp.attrPublicIp}`,
      description: "SSH command to connect to instance",
    });
  }
}
