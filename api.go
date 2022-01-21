package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"syscall"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type user struct {
	ID        string `json:"id" bson:"_id"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"-"`
	Password  string `json:"-"`
}

type slot struct {
	ID    string `bson:"_id" json:"id"`
	UID   string `json:"user"`
	Start time.Time
	End   time.Time
	Text  string
}

type jsonRequest struct {
	UserID string           `json:"user"`
	Type   string           `json:"command"`
	Text   string           `json:"text"`
	From   time.Time        `json:"from"`
	To     time.Time        `json:"to"`
	Data   *json.RawMessage `json:"data"`
}

type jsonReply struct {
	Type   string      `json:"type"`
	Status string      `json:"status"`
	Data   interface{} `json:"data,omitempty"`
}

type appContext struct {
	IP          string
	Port        string
	Path        string
	Server      *http.Server
	MongoClient *mongo.Client
	Database    *mongo.Database
	slots       *mongo.Collection
	users       *mongo.Collection
	Signals     chan os.Signal
}

func main() {
	app := appContext{IP: "172.16.0.6", Port: "8080", Path: "."}
	clientOptions := options.Client().ApplyURI("mongodb://172.16.0.5")
	client, err := mongo.NewClient(clientOptions)
	if err == nil {
		app.MongoClient = client
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(10)*time.Second)
		defer cancel()
		err = app.MongoClient.Connect(ctx)
		if err == nil {
			app.Database = app.MongoClient.Database("local")
			app.users = app.Database.Collection("users")
			app.slots = app.Database.Collection("slots")
			filter := bson.D{}
			usersCount, err := app.slots.CountDocuments(ctx, filter)
			if err == nil {
				fmt.Printf("%d users found\n", usersCount)
				if usersCount == 0 {
					userA := user{ID: primitive.NewObjectID().Hex(), Email: "a@app.com", Password: "omega", FirstName: "User", LastName: "A"}
					app.users.InsertOne(ctx, userA)
					userB := user{ID: primitive.NewObjectID().Hex(), Email: "b@app.com", Password: "omicron", FirstName: "User", LastName: "B"}
					_, err = app.users.InsertOne(ctx, userB)
					if err == nil {
						fmt.Printf("Two users %s and %s created\n", userA.ID, userB.ID)
					}
				}
			} else {
				fmt.Printf("Users search failure: %v\n", err)
			}
			slotsCount, err := app.slots.CountDocuments(ctx, filter)
			if err == nil {
				fmt.Printf("%d slots found\n", slotsCount)
			} else {
				fmt.Printf("Slots search failure: %v\n", err)
			}
		} else {
			fmt.Println("Database connection failed")
			os.Exit(1)
		}
	} else {
		fmt.Println("Database client failure:", err)
	}

	// Routing
	http.DefaultServeMux.HandleFunc("/static", app.serveRoot)
	http.DefaultServeMux.HandleFunc("/xhr", app.apiHandler)
	http.DefaultServeMux.HandleFunc("/", app.serveRoot)
	app.Server = &http.Server{
		Addr:           fmt.Sprintf("%s:%s", app.IP, app.Port),
		Handler:        http.DefaultServeMux,
		ReadTimeout:    14 * time.Second,
		WriteTimeout:   14 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	fmt.Printf("Starting web/http server on %s...\n", app.Server.Addr)

	// Graceful shutdown
	app.Signals = make(chan os.Signal, 1)
	signal.Notify(app.Signals, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		s := <-app.Signals
		fmt.Printf("RECEIVED SIGNAL: %s\n", s)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		//shutdown the server
		err := app.Server.Shutdown(ctx)
		if err == nil {
			app.MongoClient.Disconnect(ctx)
			os.Exit(1)
		} else {
			fmt.Printf("Graceful shutdown error: %v\n", err)
			app.Server.Close()
		}
	}()
	fmt.Println(app.Server.ListenAndServe().Error())
}

func (app *appContext) serveRoot(res http.ResponseWriter, req *http.Request) {
	fname := path.Base(req.URL.Path)
	fmt.Printf("[%s] Serving %s for %s\n", time.Now().Truncate(time.Second), fname, req.Header.Get("X-Forwarded-For"))
	res.Header().Set("Cache-Control", "max-age=31536000, immutable")
	res.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(res, req, filepath.Join(app.Path, req.URL.Path))
}

func (app *appContext) apiHandler(response http.ResponseWriter, request *http.Request) {
	//Recover
	// defer func() {
	// 	if err := recover(); err != nil {
	// 		fmt.Println("xhr request failed:", err)
	// 	}
	// }()
	response.Header().Set("Cache-Control", "no-cache")
	response.Header().Set("X-Content-Type-Options", "nosniff")
	response.Header().Set("Content-Type", "application/json; charset=UTF-8")

	var command jsonRequest
	var params map[string]interface{}
	ctx := context.Background()
	reply := jsonReply{Status: "error", Data: "unimplemented"}

	err := json.NewDecoder(request.Body).Decode(&command)
	if err != nil {
		fmt.Println(err)
		reply.Data = fmt.Sprintf("XHR decoding failed: %v", err)
		json.NewEncoder(response).Encode(reply)
		return
	}
	reply.Type = command.Type
	fmt.Println("Got", command.Type, "command")
	switch command.Type {
	case "users":
		result := make([]user, 0)
		userCursor, err := app.users.Find(context.Background(), bson.D{})
		if err == nil {
			defer userCursor.Close(ctx)
			for userCursor.Next(ctx) {
				var u user
				err := userCursor.Decode(&u)
				if err == nil {
					result = append(result, u)
				} else {
					fmt.Println("user decoding failed:", err.Error())
				}
			}
			if err := userCursor.Err(); err == nil {
				reply.Status = "ok"
				reply.Data = result
			} else {
				reply.Data = fmt.Sprintf("userCursor failed: %s", err.Error())
			}
		}
	case "slots":
		result := make([]slot, 0)
		err := json.Unmarshal(*command.Data, &params)
		if err == nil {
			filter := bson.D{}
			if command.UserID != "all" {
				filter = append(filter, bson.E{Key: "_id", Value: command.UserID})
			}
			//proceed with additional filter parameters here
			slotCursor, err := app.slots.Find(context.Background(), filter)
			if err == nil {
				defer slotCursor.Close(ctx)
				for slotCursor.Next(ctx) {
					var s slot
					err := slotCursor.Decode(&s)
					if err == nil {
						result = append(result, s)
					} else {
						fmt.Println("slot decoding failed:", err.Error())
					}
				}
				if err := slotCursor.Err(); err == nil {
					reply.Status = "ok"
					reply.Data = result
				} else {
					reply.Data = fmt.Sprintf("slotCursor failed: %s", err.Error())
				}
			}
		}
	case "add":
		timeZero := time.Time{}
		if command.From != timeZero && command.To != timeZero && len(command.UserID) > 1 {
			newSlot := slot{ID: primitive.NewObjectID().Hex(), UID: command.UserID, Start: command.From, End: command.To, Text: command.Text}
			result, err := app.slots.InsertOne(ctx, newSlot)
			if err == nil {
				reply.Status = "ok"
				reply.Data = fmt.Sprint(result.InsertedID)
				fmt.Printf("slot with id = %v inserted\n", result.InsertedID)
			} else {
				reply.Data = err.Error()
			}
		}
	case "delete":
		if len(command.Text) > 1 {
			result, err := app.slots.DeleteOne(ctx, bson.M{"_id": command.Text})
			if err == nil {
				reply.Status = "ok"
				reply.Data = command.Text
				fmt.Printf("removed %v document(s)\n", result.DeletedCount)
			} else {
				reply.Data = err.Error()
			}

		}
	}
	json.NewEncoder(response).Encode(reply)
}

// The system should provide a REST JSON API to provide its functionality. The project structure should be designed to be extendable.
// The database or persistence layer is free of choice. The result should be accompanied by a docker or docker compose file which allows an easy setup.
// Using the API, a separate UI (preferably React JS based) should show all entered slots, filter the slots by User ID
// and or Start, allow to create additional slot data and delete specific slots.
