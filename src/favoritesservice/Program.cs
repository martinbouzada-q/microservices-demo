using FavoritesService.Services;
using FavoritesService.Stores;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Get configuration
var favoritesServicePort = int.Parse(Environment.GetEnvironmentVariable("PORT") ?? "50052");
var redisAddr = Environment.GetEnvironmentVariable("REDIS_ADDR") ?? "redis:6379";
var enableTracing = Environment.GetEnvironmentVariable("ENABLE_TRACING") ?? "0";

// Add services
builder.Services.AddGrpc();

// Configure Redis
var redis = ConnectionMultiplexer.Connect(redisAddr);
builder.Services.AddSingleton(redis);
builder.Services.AddScoped<IFavoritesStore, RedisStore>();

// Add logging
builder.Services.AddLogging(config =>
{
    config.ClearProviders();
    config.AddConsole();
});

// Build app
var app = builder.Build();

// Map gRPC services
app.MapGrpcService<FavoritesServiceImpl>();

app.MapGet("/", () =>
{
    return Results.Ok("Favorites Service gRPC Server");
});

Console.WriteLine($"🎉 Favorites Service starting on port {favoritesServicePort}");
Console.WriteLine($"   Redis: {redisAddr}");
Console.WriteLine($"   Tracing: {(enableTracing == "1" ? "Enabled" : "Disabled")}");

app.Run($"http://0.0.0.0:{favoritesServicePort}");
