// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"net/http"
	"time"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	pb "github.com/GoogleCloudPlatform/microservices-demo/src/frontend/genproto"
)

// viewWishlistHandler renders the user's wishlist page (GET /wishlist)
func (fe *frontendServer) viewWishlistHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.Info("viewWishlist")

	sessionID := sessionID(r)
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	// Get user's favorites list
	favorites, err := fe.getFavorites(ctx, sessionID)
	if err != nil {
		log.WithError(err).Warn("could not retrieve favorites, showing empty wishlist")
		favorites = []*pb.Favorite{}
	}

	// Enrich favorites with product details and prices
	type wishlistItem struct {
		Favorite    *pb.Favorite
		Product     *pb.Product
		Price       *pb.Money
		AddedAtTime time.Time
	}
	var items []wishlistItem

	for _, fav := range favorites {
		// Get product details
		product, err := fe.getProduct(ctx, fav.ProductId)
		if err != nil {
			log.WithError(err).WithField("product_id", fav.ProductId).
				Warn("could not get product details, skipping")
			continue
		}

		// Convert price to current currency
		price, err := fe.convertCurrency(ctx, product.GetPriceUsd(), currentCurrency(r))
		if err != nil {
			log.WithError(err).WithField("product_id", fav.ProductId).
				Warn("could not convert currency, using USD")
			price = product.GetPriceUsd()
		}

		// Parse timestamp
		addedAtTime, err := time.Parse(time.RFC3339, fav.AddedAt)
		if err != nil {
			addedAtTime = time.Now()
		}

		items = append(items, wishlistItem{
			Favorite:    fav,
			Product:     product,
			Price:       price,
			AddedAtTime: addedAtTime,
		})
	}

	currencies, err := fe.getCurrencies(r.Context())
	if err != nil {
		log.WithError(err).Warn("could not retrieve currencies")
		currencies = []string{}
	}

	if err := templates.ExecuteTemplate(w, "wishlist", injectCommonTemplateData(r, map[string]interface{}{
		"show_currency": true,
		"currencies":    currencies,
		"items":         items,
		"item_count":    len(items),
	})); err != nil {
		log.Error(err)
	}
}

// addToWishlistHandler adds a product to user's wishlist (POST /wishlist/add)
func (fe *frontendServer) addToWishlistHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.Info("addToWishlist")

	if err := r.ParseForm(); err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not parse form"), http.StatusBadRequest)
		return
	}

	productID := r.FormValue("product_id")
	if productID == "" {
		renderHTTPError(log, r, w, errors.New("product_id is required"), http.StatusBadRequest)
		return
	}

	sessionID := sessionID(r)
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	// Add to favorites
	if err := fe.addFavorite(ctx, sessionID, productID); err != nil {
		log.WithError(err).WithField("product_id", productID).
			Error("failed to add favorite")
		// Continue anyway - show message on redirect
	}

	// Redirect back to referrer or to product page
	referrer := r.Header.Get("Referer")
	if referrer == "" {
		referrer = "/product/" + productID
	}

	http.Redirect(w, r, referrer, http.StatusSeeOther)
}

// removeFromWishlistHandler removes a product from user's wishlist (POST /wishlist/remove)
func (fe *frontendServer) removeFromWishlistHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.Info("removeFromWishlist")

	if err := r.ParseForm(); err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not parse form"), http.StatusBadRequest)
		return
	}

	productID := r.FormValue("product_id")
	if productID == "" {
		renderHTTPError(log, r, w, errors.New("product_id is required"), http.StatusBadRequest)
		return
	}

	sessionID := sessionID(r)
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	// Remove from favorites
	if err := fe.removeFavorite(ctx, sessionID, productID); err != nil {
		log.WithError(err).WithField("product_id", productID).
			Error("failed to remove favorite")
		// Continue anyway - show message on redirect
	}

	// Redirect back to referrer or to wishlist page
	referrer := r.Header.Get("Referer")
	if referrer == "" {
		referrer = "/wishlist"
	}

	http.Redirect(w, r, referrer, http.StatusSeeOther)
}
