cd /home/rgbadmins/Stremalit_Apps/SSO_Auth
sudo docker compose -f "/home/rgbadmins/Stremalit_Apps/HR_Portal_Hub_public/docker-compose.yml" logs -f api


###############
# Re-Create DB
cd /home/rgbadmins/Stremalit_Apps/HR_Portal_Hub_public
sudo docker compose down -v
sudo docker compose up -d --build
sudo docker compose logs -f api

##############
# Restart without building
cd /home/rgbadmins/Stremalit_Apps/HR_Portal_Hub_public
sudo docker compose restart api

##############
# Shortcut
cd /home/rgbadmins/Stremalit_Apps/HR_Portal_Hub_public
sudo docker compose up -d --build --no-deps api

###############
# Without Removing DB (fix issue)
cd /home/rgbadmins/Stremalit_Apps/HR_Portal_Hub_public
sudo docker compose exec db psql -U postgres -d innogen_sso -c "ALTER USER postgres WITH PASSWORD '<Password_Here>';"
sudo docker compose restart api

###############
# Check logs
docker logs hr-portal-app
