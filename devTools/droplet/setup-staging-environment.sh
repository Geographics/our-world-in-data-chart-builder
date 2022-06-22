## This is the script to setup a new dev staging environment
## Define Variables
#  Do a find/replace for these variables, then most of this you can copy/paste into terminal and run.
#  NEW_NAME someoneDataRelated
#  NEW_PW somePassword
#  NEW_NODE_PORT 4444

## Add proxied CNAME DNS record to Cloudflare for the owid.cloud site.
# Proxying ("orange cloud") turns on Cloudflare Access for NEW_NAME.owid.cloud.
# NEW_NAME.owid.cloud.	1	IN	CNAME	staging.owid.cloud.

# Output commands to stdout as they execute
set -ex

## Move files
cd ~
# Time: 1 minute
cp -r staging-data NEW_NAME-data
# Time: <30 sec
cp -r staging NEW_NAME
# Time: <30 sec
cp -r staging-wordpress NEW_NAME-wordpress

## Update symlinks in NEW_NAME
cd NEW_NAME
rm bakedSite
ln -s ~/NEW_NAME-data/bakedSite bakedSite
rm datasetsExport
ln -s ~/NEW_NAME-data/datasetsExport datasetsExport
rm .env
ln -s ~/NEW_NAME-data/.env .env

## Update symlink in NEW_NAME-wordpress
cd ~/NEW_NAME-wordpress
rm .env
ln -s ~/NEW_NAME-data/wordpress/.env .env

## Update .env
sed -i 's/staging/NEW_NAME/g' ~/NEW_NAME-data/.env
sed -i 's/3030/NEW_NODE_PORT/g' ~/NEW_NAME-data/.env
sed -i 's/DB_PASS=.*/DB_PASS=NEW_PW/g' ~/NEW_NAME-data/.env

# Update wordpress .env
sed -i 's/staging/NEW_NAME/g' ~/NEW_NAME-data/wordpress/.env
sed -i 's/WP_ENV=.*/WP_ENV=staging/g' ~/NEW_NAME-data/wordpress/.env
sed -i 's/DB_PASSWORD=.*/DB_PASSWORD=NEW_PW/g' ~/NEW_NAME-data/wordpress/.env

## Setup DB
# Setup databases & users
# Staging password is available from OWID staff
mysql -u root -p -Bse \
"CREATE DATABASE NEW_NAME_grapher;\
CREATE USER 'NEW_NAME_grapher'@'localhost' IDENTIFIED BY 'NEW_PW';\
GRANT ALL PRIVILEGES ON NEW_NAME_grapher.* TO 'NEW_NAME_grapher'@'localhost';\
CREATE DATABASE NEW_NAME_wordpress;\
CREATE USER 'NEW_NAME_wordpress'@'localhost' IDENTIFIED BY 'NEW_PW';\
GRANT ALL PRIVILEGES ON NEW_NAME_wordpress.* TO 'NEW_NAME_wordpress'@'localhost';"

## Nginx setup
cd /etc/nginx/sites-available
sudo cp staging.owid.cloud NEW_NAME.owid.cloud
sudo sed -i 's/staging/NEW_NAME/g' /etc/nginx/sites-available/NEW_NAME.owid.cloud
sudo sed -i 's/3030/NEW_NODE_PORT/g' /etc/nginx/sites-available/NEW_NAME.owid.cloud
sudo sed -i 's/ssl_certificate.*//g' /etc/nginx/sites-available/NEW_NAME.owid.cloud

# Verify syntax:
sudo nginx -t
# Nginx create symlink in sites-enabled
sudo ln -s /etc/nginx/sites-available/NEW_NAME.owid.cloud /etc/nginx/sites-enabled/NEW_NAME.owid.cloud
# restart
sudo systemctl reload nginx
# Note: when I resized and restarted the machine apache2 bound to 80 and so had to stop that.

## Certbot
# Make sure you've added your CNAME record to Cloudflare
sudo certbot --nginx -d NEW_NAME.owid.cloud

## Netlify
rm -rf ~/NEW_NAME-data/bakedSite/.netlify
# Create new Netlify site
cd ~/NEW_NAME-data/bakedSite/
netlify deploy --dir=. --timeout 6000
# What would you like to do?: Create + configure a new site
# Team: owid
# Site name: NEW_NAME-owid
# Leave publish to .
# As of March 2022, this took over 20 minutes which caused the client to time out - though it appears to have still worked.
netlify deploy --prodIfUnlocked

## PM2
cd ~/NEW_NAME
pm2 start --time --name NEW_NAME "yarn startAdminServer"
pm2 save
pm2 start --time --name NEW_NAME-deploy-queue "yarn startDeployQueueServer"
pm2 save

## Make deployable.
# Add NEW_NAME to the lists of staging targets:
#
# - Wordpress deploy:
#   https://github.com/owid/owid-grapher/blob/6a6767db680aec820082bc11db4acf6917ccc4af/wordpress/scripts/deploy.sh#L13
#
# - Grapher deploy:
#   https://github.com/owid/owid-grapher/blob/b80892ea5c447d9ed45846ca6270761939f96772/baker/DeployTarget.ts


## Update mysql DB:
/home/owid/NEW_NAME/devTools/droplet/refresh-staging-db.sh -c -u

## Deploy from grapher on your dev machine
# yarn buildAndDeploySite NEW_NAME
