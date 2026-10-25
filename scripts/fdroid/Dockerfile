# F-Droid's own build environment (Debian, JDK, empty Android SDK dirs) plus the fdroid tool.
FROM registry.gitlab.com/fdroid/fdroidserver:buildserver
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends fdroidserver git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# fdroidserver 2.4.2 swaps androguard's _v2_blocks list for a dict, which androguard 4.1.4 cannot use.
RUN sed -i '/apkobject._v2_blocks = NoOverwriteDict()/d' /usr/lib/python3/dist-packages/fdroidserver/common.py
USER vagrant
WORKDIR /repo
