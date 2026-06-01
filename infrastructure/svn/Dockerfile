FROM alpine:3.19

RUN apk add --no-cache subversion apache2 apache2-utils mod_dav_svn

RUN mkdir -p /var/svn/repos && \
    svnadmin create /var/svn/repos/test-repo && \
    chown -R apache:apache /var/svn/repos

COPY svnserve.conf /var/svn/repos/test-repo/conf/svnserve.conf
COPY passwd /var/svn/repos/test-repo/conf/passwd
COPY authz /var/svn/repos/test-repo/conf/authz

EXPOSE 3690 443

CMD ["svnserve", "-d", "--foreground", "-r", "/var/svn/repos", "--listen-port", "3690"]
