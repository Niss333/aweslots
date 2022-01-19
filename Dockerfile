FROM golang

#RUN adduser --disabled-password --gecos '' api
#USER api

WORKDIR $GOPATH/src
#COPY . .

RUN export GO111MODULE=auto
RUN git clone https://github.com/Niss333/aweslots.git
WORKDIR /go/src/aweslots
RUN go mod init
RUN go get go.mongodb.org/mongo-driver/bson
RUN go get go.mongodb.org/mongo-driver/mongo
RUN go get go.mongodb.org/mongo-driver/mongo/options
RUN go install
#RUN go install github.com/Niss333/aweslots@latest

# Run the outyet command by default when the container starts.
ENTRYPOINT /go/bin/aweslots

# Document that the service listens on port 8080.
EXPOSE 8080

CMD [ "aweslots" ]


