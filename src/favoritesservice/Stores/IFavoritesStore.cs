using FavoritesService.Models;

namespace FavoritesService.Stores;

/// <summary>
/// Abstraction for pluggable favorites storage backends (Redis, Spanner, AlloyDB).
/// Mirrors ICartStore pattern from CartService.
/// </summary>
public interface IFavoritesStore
{
    /// <summary>
    /// Add a product to user's wishlist. Idempotent: adding same product multiple times is no-op.
    /// </summary>
    /// <param name="userId">Session ID</param>
    /// <param name="productId">Product SKU</param>
    /// <returns>Task representing the async operation</returns>
    Task AddAsync(string userId, string productId);

    /// <summary>
    /// Retrieve user's complete wishlist, sorted by most recently added (newest first).
    /// </summary>
    /// <param name="userId">Session ID</param>
    /// <returns>List of Favorite objects (empty list if no favorites)</returns>
    Task<List<Favorite>> GetAsync(string userId);

    /// <summary>
    /// Remove a product from user's wishlist. Idempotent: removing non-existent product is no-op.
    /// </summary>
    /// <param name="userId">Session ID</param>
    /// <param name="productId">Product SKU to remove</param>
    /// <returns>Task representing the async operation</returns>
    Task RemoveAsync(string userId, string productId);

    /// <summary>
    /// Clear all products from user's wishlist.
    /// </summary>
    /// <param name="userId">Session ID</param>
    /// <returns>Task representing the async operation</returns>
    Task ClearAsync(string userId);
}
