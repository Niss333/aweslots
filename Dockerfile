FROM golang

#RUN adduser --disabled-password --gecos '' api
#USER api

WORKDIR /go/src/app
COPY . .

#RUN go get github.com/pilu/fresh
#RUN go get ./...
RUN go install github.com/Niss333/aweslots

# Run the outyet command by default when the container starts.
ENTRYPOINT /go/bin/aweslots

# Document that the service listens on port 8080.
EXPOSE 8080

CMD [ "aweslots" ]


