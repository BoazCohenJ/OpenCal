# F-Droid's own build environment (Debian, JDK, empty Android SDK dirs) plus the fdroid tool.
FROM registry.gitlab.com/fdroid/fdroidserver:buildserver
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends fdroidserver git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
USER vagrant
WORKDIR /repo
