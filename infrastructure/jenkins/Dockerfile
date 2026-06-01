FROM jenkins/jenkins:lts-jdk17

# Configuration-as-Code plugin is not bundled in the base image; without it the
# casc.yaml (admin user, etc.) is silently ignored.
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
