namespace FavoritesService.Models;

/// <summary>
/// Represents a product in a user's wishlist/favorites.
/// </summary>
public class Favorite
{
    /// <summary>
    /// Product ID (SKU from product catalog)
    /// </summary>
    public string ProductId { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp when product was added to wishlist (RFC3339/ISO 8601 format)
    /// </summary>
    public string AddedAt { get; set; } = string.Empty;

    /// <summary>
    /// Determines sort order: products are sorted by AddedAt descending (newest first)
    /// </summary>
    public int CompareTo(Favorite? other)
    {
        if (other == null) return 1;
        return DateTime.Parse(other.AddedAt).CompareTo(DateTime.Parse(this.AddedAt));
    }
}
