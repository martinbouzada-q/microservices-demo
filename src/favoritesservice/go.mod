module github.com/GoogleCloudPlatform/microservices-demo/src/favoritesservice

go 1.25.0

require (
	github.com/GoogleCloudPlatform/microservices-demo/src/frontend v0.0.0-20260324180953-c9857ee54fba
	google.golang.org/grpc v1.80.0
)

require (
	golang.org/x/net v0.51.0 // indirect
	golang.org/x/sys v0.41.0 // indirect
	golang.org/x/text v0.34.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260226221140-a57be14db171 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
)

replace github.com/GoogleCloudPlatform/microservices-demo/src/frontend => ../frontend
