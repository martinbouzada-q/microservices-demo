using System.Text.Json;
using FavoritesService.Models;
using StackExchange.Redis;

namespace FavoritesService.Stores;

/// <summary>
/// Redis-backed implementation of IFavoritesStore.
/// Stores wishlist as JSON-serialized list of Favorite objects, keyed by user_id (session ID).
/// Uses atomic read-modify-write pattern to prevent race conditions.
/// </summary>
public class RedisStore : IFavoritesStore
{
    private readonly IDatabase _db;
    private readonly ILogger<RedisStore> _logger;
    private const string KeyPrefix = "favorites:";
    private const int SessionTtlSeconds = 48 * 60 * 60; // 48 hours matching shop_session-id cookie TTL

    public RedisStore(IConnectionMultiplexer redis, ILogger<RedisStore> logger)
    {
        _db = redis.GetDatabase();
        _logger = logger;
    }

    /// <summary>
    /// Add product to wishlist. Idempotent: duplicate adds are no-op.
    /// </summary>
    public async Task AddAsync(string userId, string productId)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(productId))
        {
            _logger.LogWarning("AddAsync called with invalid parameters: userId={userId}, productId={productId}", userId, productId);
            return;
        }

        var key = $"{KeyPrefix}{userId}";

        // Atomic read-modify-write to prevent race conditions
        var json = await _db.StringGetAsync(key);
        var favorites = json.HasValue
            ? JsonSerializer.Deserialize<List<Favorite>>(json.ToString()) ?? new List<Favorite>()
            : new List<Favorite>();

        // Check if already exists (idempotency)
        if (favorites.Any(f => f.ProductId == productId))
        {
            _logger.LogDebug("Product {productId} already in favorites for user {userId}", productId, userId);
            return;
        }

        // Add with current timestamp
        favorites.Add(new Favorite
        {
            ProductId = productId,
            AddedAt = DateTime.UtcNow.ToString("O") // RFC3339 format
        });

        // Store updated list
        var updatedJson = JsonSerializer.Serialize(favorites);
        await _db.StringSetAsync(key, updatedJson, TimeSpan.FromSeconds(SessionTtlSeconds));

        _logger.LogInformation("Added {productId} to favorites for user {userId}", productId, userId);
    }

    /// <summary>
    /// Get all favorites for a user, sorted by most recently added (newest first).
    /// </summary>
    public async Task<List<Favorite>> GetAsync(string userId)
    {
        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogWarning("GetAsync called with empty userId");
            return new List<Favorite>();
        }

        var key = $"{KeyPrefix}{userId}";
        var json = await _db.StringGetAsync(key);

        if (!json.HasValue)
        {
            return new List<Favorite>();
        }

        var favorites = JsonSerializer.Deserialize<List<Favorite>>(json.ToString()) ?? new List<Favorite>();

        // Sort by AddedAt descending (newest first)
        favorites.Sort((a, b) => DateTime.Parse(b.AddedAt).CompareTo(DateTime.Parse(a.AddedAt)));

        return favorites;
    }

    /// <summary>
    /// Remove a product from wishlist. Idempotent: removing non-existent product is no-op.
    /// </summary>
    public async Task RemoveAsync(string userId, string productId)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(productId))
        {
            _logger.LogWarning("RemoveAsync called with invalid parameters: userId={userId}, productId={productId}", userId, productId);
            return;
        }

        var key = $"{KeyPrefix}{userId}";
        var json = await _db.StringGetAsync(key);

        if (!json.HasValue)
        {
            _logger.LogDebug("No favorites found for user {userId}", userId);
            return;
        }

        var favorites = JsonSerializer.Deserialize<List<Favorite>>(json.ToString()) ?? new List<Favorite>();
        var initialCount = favorites.Count;

        // Remove all matching products
        favorites.RemoveAll(f => f.ProductId == productId);

        if (favorites.Count == initialCount)
        {
            _logger.LogDebug("Product {productId} not found in favorites for user {userId}", productId, userId);
            return;
        }

        // Update storage
        if (favorites.Count == 0)
        {
            // Delete key if list is empty
            await _db.KeyDeleteAsync(key);
        }
        else
        {
            var updatedJson = JsonSerializer.Serialize(favorites);
            await _db.StringSetAsync(key, updatedJson, TimeSpan.FromSeconds(SessionTtlSeconds));
        }

        _logger.LogInformation("Removed {productId} from favorites for user {userId}", productId, userId);
    }

    /// <summary>
    /// Clear all favorites for a user.
    /// </summary>
    public async Task ClearAsync(string userId)
    {
        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogWarning("ClearAsync called with empty userId");
            return;
        }

        var key = $"{KeyPrefix}{userId}";
        await _db.KeyDeleteAsync(key);

        _logger.LogInformation("Cleared all favorites for user {userId}", userId);
    }
}
