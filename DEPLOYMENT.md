# Deployment Guide - EC2 with PM2

This guide explains how to set up automated deployment from GitHub Actions to your EC2 instance using PM2.

## Prerequisites

1. EC2 instance running Ubuntu (or similar Linux distribution)
2. PM2 installed on the EC2 instance
3. Git repository with your code
4. Node.js and npm installed on EC2

## Setup Instructions

### 1. Prepare EC2 Instance

#### Install PM2 (if not already installed)
```bash
npm install -g pm2
```

#### Install Node.js (if not already installed)
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Clone your repository (if not already cloned)
```bash
cd /home/ubuntu  # or your preferred directory
git clone <your-repo-url> BudgetBuddy
cd BudgetBuddy
npm install
npm run build
```

#### Start your application with PM2
```bash
pm2 start npm --name budgetbuddy -- start
pm2 save
pm2 startup  # Follow the instructions to enable PM2 on system startup
```

### 2. Generate SSH Key Pair for Deployment

On your local machine or in GitHub Actions, generate an SSH key:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy
```

**Do NOT set a passphrase** (press Enter when prompted) as GitHub Actions cannot handle interactive password prompts.

### 3. Add Public Key to EC2 Instance

Copy the public key to your EC2 instance:

```bash
# On your local machine
cat ~/.ssh/github_actions_deploy.pub

# On EC2 instance, add it to authorized_keys
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 4. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

1. **EC2_HOST**: Your EC2 instance public IP or domain name
   - Example: `ec2-12-34-56-78.compute-1.amazonaws.com` or `12.34.56.78`

2. **EC2_USER**: SSH username for your EC2 instance
   - Example: `ubuntu` (default for Ubuntu AMI)

3. **EC2_SSH_KEY**: Your private SSH key (the entire content)
   - Copy the entire content of `~/.ssh/github_actions_deploy` (the private key)
   - Include the `-----BEGIN` and `-----END` lines

4. **EC2_APP_DIR**: Full path to your application directory on EC2
   - Example: `/home/ubuntu/BudgetBuddy`

5. **PM2_APP_NAME**: The name of your PM2 application
   - Example: `budgetbuddy` (must match the name used in `pm2 start`)

### 5. Test the Deployment

#### Manual Test (on EC2)
You can test the deployment script manually:

```bash
cd /home/ubuntu/BudgetBuddy
chmod +x deploy.sh
./deploy.sh
```

#### Test GitHub Actions
1. Make a small change to your code
2. Commit and push to `main` or `master` branch
3. Go to GitHub → Actions tab
4. Watch the deployment workflow run

### 6. Verify Deployment

After deployment, check your application:

```bash
# On EC2 instance
pm2 status
pm2 logs budgetbuddy --lines 50
```

## Workflow Details

The GitHub Actions workflow (`/.github/workflows/deploy.yml`) does the following:

1. **Checks out code** from the repository
2. **Sets up Node.js** environment
3. **Installs dependencies** using `npm ci`
4. **Builds the application** using `npm run build`
5. **SSH into EC2** and:
   - Pulls latest code
   - Installs dependencies
   - Builds the application
   - Restarts PM2 application
6. **Verifies deployment** by checking PM2 status

## Troubleshooting

### SSH Connection Issues

If you get SSH connection errors:

1. Check EC2 security group allows SSH (port 22) from GitHub Actions IPs
2. Verify the SSH key is correctly added to `authorized_keys`
3. Test SSH connection manually:
   ```bash
   ssh -i ~/.ssh/github_actions_deploy ubuntu@YOUR_EC2_HOST
   ```

### PM2 Not Found

If PM2 is not found during deployment:

```bash
# On EC2 instance
npm install -g pm2
pm2 startup
```

### Build Failures

If the build fails:

1. Check Node.js version matches (should be 18+)
2. Verify all dependencies are in `package.json`
3. Check build logs in GitHub Actions

### Application Not Starting

If the application doesn't start:

1. Check PM2 logs: `pm2 logs budgetbuddy`
2. Verify environment variables are set
3. Check if the port is available
4. Verify database connections

### Permission Issues

If you get permission errors:

```bash
# On EC2 instance
sudo chown -R $USER:$USER /home/ubuntu/BudgetBuddy
chmod +x deploy.sh
```

## Manual Deployment

If you need to deploy manually without GitHub Actions:

```bash
# On EC2 instance
cd /home/ubuntu/BudgetBuddy
./deploy.sh
```

Or use the commands directly:

```bash
cd /home/ubuntu/BudgetBuddy
git pull origin main
npm ci
npm run build
pm2 restart budgetbuddy
```

## Environment Variables

Make sure your environment variables are set on the EC2 instance. You can:

1. Use a `.env` file (make sure it's in `.gitignore`)
2. Use PM2 ecosystem file
3. Set them in your shell profile

Example PM2 ecosystem file (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'budgetbuddy',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 5003,
      // Add your other environment variables here
    }
  }]
};
```

Then start with:
```bash
pm2 start ecosystem.config.js
```

## Security Best Practices

1. **Never commit SSH keys** to the repository
2. **Use GitHub Secrets** for all sensitive information
3. **Restrict EC2 security group** to only allow necessary ports
4. **Use IAM roles** instead of access keys when possible
5. **Regularly rotate SSH keys**
6. **Keep dependencies updated** for security patches

## Monitoring

Set up monitoring for your deployment:

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs budgetbuddy

# View metrics
pm2 status
```

## Rollback

If a deployment fails, you can rollback:

```bash
# On EC2 instance
cd /home/ubuntu/BudgetBuddy
git checkout <previous-commit-hash>
npm ci
npm run build
pm2 restart budgetbuddy
```

