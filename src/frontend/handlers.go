// Copyright 2018 Google LLC
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
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"math/rand"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	pb "github.com/GoogleCloudPlatform/microservices-demo/src/frontend/genproto"
	"github.com/GoogleCloudPlatform/microservices-demo/src/frontend/money"
	"github.com/GoogleCloudPlatform/microservices-demo/src/frontend/validator"
)

type platformDetails struct {
	css      string
	provider string
}

var (
	frontendMessage  = strings.TrimSpace(os.Getenv("FRONTEND_MESSAGE"))
	isCymbalBrand    = "true" == strings.ToLower(os.Getenv("CYMBAL_BRANDING"))
	assistantEnabled = "true" == strings.ToLower(os.Getenv("ENABLE_ASSISTANT"))
	templates        = template.Must(template.New("").
				Funcs(template.FuncMap{
			"renderMoney":         renderMoney,
			"renderCurrencyLogo":  renderCurrencyLogo,
			"formatDate":          formatDate,
			"formatDateTime":      formatDateTime,
			"formatOrderStatus":   formatOrderStatus,
			"formatPaymentStatus": formatPaymentStatus,
			"add":                 func(a, b int) int { return a + b },
			"sub":                 func(a, b int) int { return a - b },
			"seq":                 seq,
		}).ParseGlob("templates/*.html"))
	plat platformDetails
)

var validEnvs = []string{"local", "gcp", "azure", "aws", "onprem", "alibaba"}

func (fe *frontendServer) homeHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.WithField("currency", currentCurrency(r)).Info("home")
	currencies, err := fe.getCurrencies(r.Context())
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve currencies"), http.StatusInternalServerError)
		return
	}
	products, err := fe.getProducts(r.Context())
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve products"), http.StatusInternalServerError)
		return
	}
	cart, err := fe.getCart(r.Context(), sessionID(r))
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve cart"), http.StatusInternalServerError)
		return
	}

	type productView struct {
		Item  *pb.Product
		Price *pb.Money
	}
	ps := make([]productView, len(products))
	for i, p := range products {
		price, err := fe.convertCurrency(r.Context(), p.GetPriceUsd(), currentCurrency(r))
		if err != nil {
			renderHTTPError(log, r, w, errors.Wrapf(err, "failed to do currency conversion for product %s", p.GetId()), http.StatusInternalServerError)
			return
		}
		ps[i] = productView{p, price}
	}

	// Set ENV_PLATFORM (default to local if not set; use env var if set; otherwise detect GCP, which overrides env)_
	var env = os.Getenv("ENV_PLATFORM")
	// Only override from env variable if set + valid env
	if env == "" || stringinSlice(validEnvs, env) == false {
		fmt.Println("env platform is either empty or invalid")
		env = "local"
	}
	// Autodetect GCP
	addrs, err := net.LookupHost("metadata.google.internal.")
	if err == nil && len(addrs) >= 0 {
		log.Debugf("Detected Google metadata server: %v, setting ENV_PLATFORM to GCP.", addrs)
		env = "gcp"
	}

	log.Debugf("ENV_PLATFORM is: %s", env)
	plat = platformDetails{}
	plat.setPlatformDetails(strings.ToLower(env))

	if err := templates.ExecuteTemplate(w, "home", injectCommonTemplateData(r, map[string]interface{}{
		"show_currency": true,
		"currencies":    currencies,
		"products":      ps,
		"cart_size":     cartSize(cart),
		"banner_color":  os.Getenv("BANNER_COLOR"), // illustrates canary deployments
		"ad":            fe.chooseAd(r.Context(), []string{}, log),
	})); err != nil {
		log.Error(err)
	}
}

func (plat *platformDetails) setPlatformDetails(env string) {
	if env == "aws" {
		plat.provider = "AWS"
		plat.css = "aws-platform"
	} else if env == "onprem" {
		plat.provider = "On-Premises"
		plat.css = "onprem-platform"
	} else if env == "azure" {
		plat.provider = "Azure"
		plat.css = "azure-platform"
	} else if env == "gcp" {
		plat.provider = "Google Cloud"
		plat.css = "gcp-platform"
	} else if env == "alibaba" {
		plat.provider = "Alibaba Cloud"
		plat.css = "alibaba-platform"
	} else {
		plat.provider = "local"
		plat.css = "local"
	}
}

func (fe *frontendServer) productHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	id := mux.Vars(r)["id"]
	if id == "" {
		renderHTTPError(log, r, w, errors.New("product id not specified"), http.StatusBadRequest)
		return
	}
	log.WithField("id", id).WithField("currency", currentCurrency(r)).
		Debug("serving product page")

	p, err := fe.getProduct(r.Context(), id)
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve product"), http.StatusInternalServerError)
		return
	}
	currencies, err := fe.getCurrencies(r.Context())
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve currencies"), http.StatusInternalServerError)
		return
	}

	cart, err := fe.getCart(r.Context(), sessionID(r))
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve cart"), http.StatusInternalServerError)
		return
	}

	price, err := fe.convertCurrency(r.Context(), p.GetPriceUsd(), currentCurrency(r))
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "failed to convert currency"), http.StatusInternalServerError)
		return
	}

	// ignores the error retrieving recommendations since it is not critical
	recommendations, err := fe.getRecommendations(r.Context(), sessionID(r), []string{id})
	if err != nil {
		log.WithField("error", err).Warn("failed to get product recommendations")
	}

	product := struct {
		Item  *pb.Product
		Price *pb.Money
	}{p, price}

	// Fetch packaging info (weight/dimensions) of the product
	// The packaging service is an optional microservice you can run as part of a Google Cloud demo.
	var packagingInfo *PackagingInfo = nil
	if isPackagingServiceConfigured() {
		packagingInfo, err = httpGetPackagingInfo(id)
		if err != nil {
			fmt.Println("Failed to obtain product's packaging info:", err)
		}
	}

	if err := templates.ExecuteTemplate(w, "product", injectCommonTemplateData(r, map[string]interface{}{
		"ad":              fe.chooseAd(r.Context(), p.Categories, log),
		"show_currency":   true,
		"currencies":      currencies,
		"product":         product,
		"recommendations": recommendations,
		"cart_size":       cartSize(cart),
		"packagingInfo":   packagingInfo,
	})); err != nil {
		log.Println(err)
	}
}

func (fe *frontendServer) addToCartHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	quantity, _ := strconv.ParseUint(r.FormValue("quantity"), 10, 32)
	productID := r.FormValue("product_id")
	payload := validator.AddToCartPayload{
		Quantity:  quantity,
		ProductID: productID,
	}
	if err := payload.Validate(); err != nil {
		renderHTTPError(log, r, w, validator.ValidationErrorResponse(err), http.StatusUnprocessableEntity)
		return
	}
	log.WithField("product", payload.ProductID).WithField("quantity", payload.Quantity).Debug("adding to cart")

	p, err := fe.getProduct(r.Context(), payload.ProductID)
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve product"), http.StatusInternalServerError)
		return
	}

	if err := fe.insertCart(r.Context(), sessionID(r), p.GetId(), int32(payload.Quantity)); err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "failed to add to cart"), http.StatusInternalServerError)
		return
	}
	w.Header().Set("location", baseUrl + "/cart")
	w.WriteHeader(http.StatusFound)
}

// apiAddToCartHandler handles AJAX POST requests from add-to-cart.js
// Returns JSON response instead of 302 redirect
func (fe *frontendServer) apiAddToCartHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)

	// Parse JSON request body
	var req struct {
		ProductID string `json:"productId"`
		Quantity  uint64 `json:"quantity"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid request body",
			"retryable": false,
		})
		return
	}

	// Validate payload
	payload := validator.AddToCartPayload{
		Quantity:  req.Quantity,
		ProductID: req.ProductID,
	}
	if err := payload.Validate(); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
			"retryable": false,
		})
		return
	}

	log.WithField("product", payload.ProductID).WithField("quantity", payload.Quantity).Debug("adding to cart via API")

	// Get product details
	p, err := fe.getProduct(r.Context(), payload.ProductID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Could not retrieve product",
			"retryable": true,
		})
		log.WithError(err).Error("failed to get product")
		return
	}

	// Insert to cart
	if err := fe.insertCart(r.Context(), sessionID(r), p.GetId(), int32(payload.Quantity)); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to add item to cart",
			"retryable": true,
		})
		log.WithError(err).Error("failed to insert to cart")
		return
	}

	// Get updated cart size
	cartItems, err := fe.getCart(r.Context(), sessionID(r))
	if err != nil {
		log.WithError(err).Warn("could not retrieve cart size after add")
	}

	cartSize := 0
	if cartItems != nil {
		cartSize = len(cartItems)
	}

	// Success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"cartSize": cartSize,
		"message": fmt.Sprintf("Added %d item(s) to cart", payload.Quantity),
	})
}

func (fe *frontendServer) emptyCartHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.Debug("emptying cart")

	if err := fe.emptyCart(r.Context(), sessionID(r)); err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "failed to empty cart"), http.StatusInternalServerError)
		return
	}
	w.Header().Set("location", baseUrl + "/")
	w.WriteHeader(http.StatusFound)
}

func (fe *frontendServer) viewCartHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.Debug("view user cart")
	currencies, err := fe.getCurrencies(r.Context())
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve currencies"), http.StatusInternalServerError)
		return
	}
	cart, err := fe.getCart(r.Context(), sessionID(r))
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve cart"), http.StatusInternalServerError)
		return
	}

	// ignores the error retrieving recommendations since it is not critical
	recommendations, err := fe.getRecommendations(r.Context(), sessionID(r), cartIDs(cart))
	if err != nil {
		log.WithField("error", err).Warn("failed to get product recommendations")
	}

	shippingCost, err := fe.getShippingQuote(r.Context(), cart, currentCurrency(r))
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "failed to get shipping quote"), http.StatusInternalServerError)
		return
	}

	type cartItemView struct {
		Item     *pb.Product
		Quantity int32
		Price    *pb.Money
	}
	items := make([]cartItemView, len(cart))
	totalPrice := pb.Money{CurrencyCode: currentCurrency(r)}
	for i, item := range cart {
		p, err := fe.getProduct(r.Context(), item.GetProductId())
		if err != nil {
			renderHTTPError(log, r, w, errors.Wrapf(err, "could not retrieve product #%s", item.GetProductId()), http.StatusInternalServerError)
			return
		}
		price, err := fe.convertCurrency(r.Context(), p.GetPriceUsd(), currentCurrency(r))
		if err != nil {
			renderHTTPError(log, r, w, errors.Wrapf(err, "could not convert currency for product #%s", item.GetProductId()), http.StatusInternalServerError)
			return
		}

		multPrice := money.MultiplySlow(*price, uint32(item.GetQuantity()))
		items[i] = cartItemView{
			Item:     p,
			Quantity: item.GetQuantity(),
			Price:    &multPrice}
		totalPrice = money.Must(money.Sum(totalPrice, multPrice))
	}
	totalPrice = money.Must(money.Sum(totalPrice, *shippingCost))
	year := time.Now().Year()

	if err := templates.ExecuteTemplate(w, "cart", injectCommonTemplateData(r, map[string]interface{}{
		"currencies":       currencies,
		"recommendations":  recommendations,
		"cart_size":        cartSize(cart),
		"shipping_cost":    shippingCost,
		"show_currency":    true,
		"total_cost":       totalPrice,
		"items":            items,
		"expiration_years": []int{year, year + 1, year + 2, year + 3, year + 4},
	})); err != nil {
		log.Println(err)
	}
}

func (fe *frontendServer) placeOrderHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.Debug("placing order")

	var (
		email         = r.FormValue("email")
		streetAddress = r.FormValue("street_address")
		zipCode, _    = strconv.ParseInt(r.FormValue("zip_code"), 10, 32)
		city          = r.FormValue("city")
		state         = r.FormValue("state")
		country       = r.FormValue("country")
		ccNumber      = r.FormValue("credit_card_number")
		ccMonth, _    = strconv.ParseInt(r.FormValue("credit_card_expiration_month"), 10, 32)
		ccYear, _     = strconv.ParseInt(r.FormValue("credit_card_expiration_year"), 10, 32)
		ccCVV, _      = strconv.ParseInt(r.FormValue("credit_card_cvv"), 10, 32)
	)

	payload := validator.PlaceOrderPayload{
		Email:         email,
		StreetAddress: streetAddress,
		ZipCode:       zipCode,
		City:          city,
		State:         state,
		Country:       country,
		CcNumber:      ccNumber,
		CcMonth:       ccMonth,
		CcYear:        ccYear,
		CcCVV:         ccCVV,
	}
	if err := payload.Validate(); err != nil {
		renderHTTPError(log, r, w, validator.ValidationErrorResponse(err), http.StatusUnprocessableEntity)
		return
	}

	order, err := pb.NewCheckoutServiceClient(fe.checkoutSvcConn).
		PlaceOrder(r.Context(), &pb.PlaceOrderRequest{
			Email: payload.Email,
			CreditCard: &pb.CreditCardInfo{
				CreditCardNumber:          payload.CcNumber,
				CreditCardExpirationMonth: int32(payload.CcMonth),
				CreditCardExpirationYear:  int32(payload.CcYear),
				CreditCardCvv:             int32(payload.CcCVV)},
			UserId:       sessionID(r),
			UserCurrency: currentCurrency(r),
			Address: &pb.Address{
				StreetAddress: payload.StreetAddress,
				City:          payload.City,
				State:         payload.State,
				ZipCode:       int32(payload.ZipCode),
				Country:       payload.Country},
		})
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "failed to complete the order"), http.StatusInternalServerError)
		return
	}
	log.WithField("order", order.GetOrder().GetOrderId()).Info("order placed")

	order.GetOrder().GetItems()
	recommendations, _ := fe.getRecommendations(r.Context(), sessionID(r), nil)

	totalPaid := *order.GetOrder().GetShippingCost()
	for _, v := range order.GetOrder().GetItems() {
		multPrice := money.MultiplySlow(*v.GetCost(), uint32(v.GetItem().GetQuantity()))
		totalPaid = money.Must(money.Sum(totalPaid, multPrice))
	}

	currencies, err := fe.getCurrencies(r.Context())
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve currencies"), http.StatusInternalServerError)
		return
	}

	if err := templates.ExecuteTemplate(w, "order", injectCommonTemplateData(r, map[string]interface{}{
		"show_currency":   false,
		"currencies":      currencies,
		"order":           order.GetOrder(),
		"total_paid":      &totalPaid,
		"recommendations": recommendations,
	})); err != nil {
		log.Println(err)
	}
}

func (fe *frontendServer) assistantHandler(w http.ResponseWriter, r *http.Request) {
	currencies, err := fe.getCurrencies(r.Context())
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve currencies"), http.StatusInternalServerError)
		return
	}

	if err := templates.ExecuteTemplate(w, "assistant", injectCommonTemplateData(r, map[string]interface{}{
		"show_currency": false,
		"currencies":    currencies,
	})); err != nil {
		log.Println(err)
	}
}

func (fe *frontendServer) logoutHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.Debug("logging out")
	for _, c := range r.Cookies() {
		c.Expires = time.Now().Add(-time.Hour * 24 * 365)
		c.MaxAge = -1
		http.SetCookie(w, c)
	}
	w.Header().Set("Location", baseUrl + "/")
	w.WriteHeader(http.StatusFound)
}

func (fe *frontendServer) getProductByID(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["ids"]
	if id == "" {
		return
	}

	p, err := fe.getProduct(r.Context(), id)
	if err != nil {
		return
	}

	jsonData, err := json.Marshal(p)
	if err != nil {
		fmt.Println(err)
		return
	}

	w.Write(jsonData)
	w.WriteHeader(http.StatusOK)
}

func (fe *frontendServer) chatBotHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	type Response struct {
		Message string `json:"message"`
	}

	type LLMResponse struct {
		Content string         `json:"content"`
		Details map[string]any `json:"details"`
	}

	var response LLMResponse

	url := "http://" + fe.shoppingAssistantSvcAddr
	req, err := http.NewRequest(http.MethodPost, url, r.Body)
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "failed to create request"), http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "failed to send request"), http.StatusInternalServerError)
		return
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "failed to read response"), http.StatusInternalServerError)
		return
	}

	fmt.Printf("%+v\n", body)
	fmt.Printf("%+v\n", res)

	err = json.Unmarshal(body, &response)
	if err != nil {
		renderHTTPError(log, r, w, errors.Wrap(err, "failed to unmarshal body"), http.StatusInternalServerError)
		return
	}

	// respond with the same message
	json.NewEncoder(w).Encode(Response{Message: response.Content})

	w.WriteHeader(http.StatusOK)
}

func (fe *frontendServer) setCurrencyHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	cur := r.FormValue("currency_code")
	payload := validator.SetCurrencyPayload{Currency: cur}
	if err := payload.Validate(); err != nil {
		renderHTTPError(log, r, w, validator.ValidationErrorResponse(err), http.StatusUnprocessableEntity)
		return
	}
	log.WithField("curr.new", payload.Currency).WithField("curr.old", currentCurrency(r)).
		Debug("setting currency")

	if payload.Currency != "" {
		http.SetCookie(w, &http.Cookie{
			Name:   cookieCurrency,
			Value:  payload.Currency,
			MaxAge: cookieMaxAge,
		})
	}
	referer := r.Header.Get("referer")
	if referer == "" {
		referer = baseUrl + "/"
	}
	w.Header().Set("Location", referer)
	w.WriteHeader(http.StatusFound)
}

// chooseAd queries for advertisements available and randomly chooses one, if
// available. It ignores the error retrieving the ad since it is not critical.
func (fe *frontendServer) chooseAd(ctx context.Context, ctxKeys []string, log logrus.FieldLogger) *pb.Ad {
	ads, err := fe.getAd(ctx, ctxKeys)
	if err != nil {
		log.WithField("error", err).Warn("failed to retrieve ads")
		return nil
	}
	return ads[rand.Intn(len(ads))]
}

func renderHTTPError(log logrus.FieldLogger, r *http.Request, w http.ResponseWriter, err error, code int) {
	log.WithField("error", err).Error("request error")
	errMsg := fmt.Sprintf("%+v", err)

	w.WriteHeader(code)

	if templateErr := templates.ExecuteTemplate(w, "error", injectCommonTemplateData(r, map[string]interface{}{
		"error":       errMsg,
		"status_code": code,
		"status":      http.StatusText(code),
	})); templateErr != nil {
		log.Println(templateErr)
	}
}

func injectCommonTemplateData(r *http.Request, payload map[string]interface{}) map[string]interface{} {
	data := map[string]interface{}{
		"session_id":        sessionID(r),
		"request_id":        r.Context().Value(ctxKeyRequestID{}),
		"user_currency":     currentCurrency(r),
		"platform_css":      plat.css,
		"platform_name":     plat.provider,
		"is_cymbal_brand":   isCymbalBrand,
		"assistant_enabled": assistantEnabled,
		"deploymentDetails": deploymentDetailsMap,
		"frontendMessage":   frontendMessage,
		"currentYear":       time.Now().Year(),
		"baseUrl":           baseUrl,
	}

	for k, v := range payload {
		data[k] = v
	}

	return data
}

func currentCurrency(r *http.Request) string {
	c, _ := r.Cookie(cookieCurrency)
	if c != nil {
		return c.Value
	}
	return defaultCurrency
}

func sessionID(r *http.Request) string {
	v := r.Context().Value(ctxKeySessionID{})
	if v != nil {
		return v.(string)
	}
	return ""
}

func cartIDs(c []*pb.CartItem) []string {
	out := make([]string, len(c))
	for i, v := range c {
		out[i] = v.GetProductId()
	}
	return out
}

// get total # of items in cart
func cartSize(c []*pb.CartItem) int {
	cartSize := 0
	for _, item := range c {
		cartSize += int(item.GetQuantity())
	}
	return cartSize
}

func renderMoney(money pb.Money) string {
	currencyLogo := renderCurrencyLogo(money.GetCurrencyCode())
	return fmt.Sprintf("%s%d.%02d", currencyLogo, money.GetUnits(), money.GetNanos()/10000000)
}

func renderCurrencyLogo(currencyCode string) string {
	logos := map[string]string{
		"USD": "$",
		"CAD": "$",
		"JPY": "¥",
		"EUR": "€",
		"TRY": "₺",
		"GBP": "£",
	}

	logo := "$" //default
	if val, ok := logos[currencyCode]; ok {
		logo = val
	}
	return logo
}

func stringinSlice(slice []string, val string) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}

// Order-related handlers for SCRUM-2

type orderItemView struct {
	Item          *pb.CartItem
	ProductName   string
	ItemPrice     *pb.Money
	ItemSubtotal  *pb.Money
}

type orderView struct {
	OrderId                  string
	CreatedAt                string
	ShippingStatus           string
	ShippingStatusBadgeClass string
	PaymentStatus            string
	PaymentStatusBadgeClass  string
	ShippingAddress          *pb.Address
	TotalCost                *pb.Money
	SubtotalCost             *pb.Money
	ShippingCost             *pb.Money
	Items                    []orderItemView
	TrackingId               string
	PaymentTransactionId     string
	ShippedAt                string
	DeliveredAt              string
	EstimatedDeliveryDate    string
	StatusPlaced             bool
	StatusProcessing         bool
	StatusShipped            bool
	StatusDelivered          bool
}

// getMockOrders returns mock order data for demonstration purposes
// In production, this would call the OrderService gRPC
func (fe *frontendServer) getMockOrders(userID string) []orderView {
	// Sample mock orders for demonstration - 27 orders to test pagination with 20/page
	orders := []orderView{
		{
			OrderId:                  "ORD-20260416-027",
			CreatedAt:                "2026-04-16T08:00:00Z",
			ShippingStatus:           "processing",
			ShippingStatusBadgeClass: "info",
			PaymentStatus:            "completed",
			PaymentStatusBadgeClass:  "success",
			PaymentTransactionId:     "TXN-20260416-027",
			StatusPlaced:             true,
			StatusProcessing:         true,
			StatusShipped:            false,
			StatusDelivered:          false,
			TotalCost: &pb.Money{CurrencyCode: "USD", Units: 34, Nanos: 990000000},
			SubtotalCost: &pb.Money{CurrencyCode: "USD", Units: 29, Nanos: 990000000},
			ShippingCost: &pb.Money{CurrencyCode: "USD", Units: 5, Nanos: 0},
			Items: []orderItemView{{Item: &pb.CartItem{ProductId: "2ZRWG08", Quantity: 1}, ProductName: "Striped Socks", ItemPrice: &pb.Money{CurrencyCode: "USD", Units: 12, Nanos: 0}, ItemSubtotal: &pb.Money{CurrencyCode: "USD", Units: 12, Nanos: 0}}},
			ShippingAddress: &pb.Address{StreetAddress: "999 Park Ln", City: "Boston", State: "MA", Country: "US", ZipCode: 02101},
		},
		{
			OrderId:                  "ORD-20260415-026",
			CreatedAt:                "2026-04-15T16:45:00Z",
			ShippingStatus:           "shipped",
			ShippingStatusBadgeClass: "warning",
			PaymentStatus:            "completed",
			PaymentStatusBadgeClass:  "success",
			TrackingId:               "1Z999CC30987654321",
			PaymentTransactionId:     "TXN-20260415-026",
			ShippedAt:                "2026-04-16T10:30:00Z",
			StatusPlaced:             true,
			StatusProcessing:         true,
			StatusShipped:            true,
			StatusDelivered:          false,
			TotalCost: &pb.Money{CurrencyCode: "USD", Units: 89, Nanos: 950000000},
			SubtotalCost: &pb.Money{CurrencyCode: "USD", Units: 79, Nanos: 950000000},
			ShippingCost: &pb.Money{CurrencyCode: "USD", Units: 10, Nanos: 0},
			Items: []orderItemView{{Item: &pb.CartItem{ProductId: "0PUK6V6EV0", Quantity: 1}, ProductName: "Cloud White Sneakers", ItemPrice: &pb.Money{CurrencyCode: "USD", Units: 79, Nanos: 950000000}, ItemSubtotal: &pb.Money{CurrencyCode: "USD", Units: 79, Nanos: 950000000}}},
			ShippingAddress: &pb.Address{StreetAddress: "888 Oak St", City: "Portland", State: "OR", Country: "US", ZipCode: 97201},
		},
		{
			OrderId:                  "ORD-20260414-025",
			CreatedAt:                "2026-04-14T14:30:00Z",
			ShippingStatus:           "shipped",
			ShippingStatusBadgeClass: "warning",
			PaymentStatus:            "completed",
			PaymentStatusBadgeClass:  "success",
			TrackingId:               "1Z999AA10123456784",
			PaymentTransactionId:     "TXN-20260414-025",
			ShippedAt:                "2026-04-15T09:00:00Z",
			StatusPlaced:             true,
			StatusProcessing:         true,
			StatusShipped:            true,
			StatusDelivered:          false,
			TotalCost: &pb.Money{CurrencyCode: "USD", Units: 47, Nanos: 990000000},
			SubtotalCost: &pb.Money{CurrencyCode: "USD", Units: 39, Nanos: 990000000},
			ShippingCost: &pb.Money{CurrencyCode: "USD", Units: 8, Nanos: 0},
			Items: []orderItemView{{Item: &pb.CartItem{ProductId: "OLJCESPC7Z", Quantity: 1}, ProductName: "Vintage Sunglasses", ItemPrice: &pb.Money{CurrencyCode: "USD", Units: 19, Nanos: 990000000}, ItemSubtotal: &pb.Money{CurrencyCode: "USD", Units: 19, Nanos: 990000000}}, {Item: &pb.CartItem{ProductId: "9SIQT8TOJO", Quantity: 2}, ProductName: "Camera Lens", ItemPrice: &pb.Money{CurrencyCode: "USD", Units: 10, Nanos: 0}, ItemSubtotal: &pb.Money{CurrencyCode: "USD", Units: 20, Nanos: 0}}},
			ShippingAddress: &pb.Address{StreetAddress: "123 Main St", City: "San Francisco", State: "CA", Country: "US", ZipCode: 94102},
		},
		{
			OrderId:                  "ORD-20260410-024",
			CreatedAt:                "2026-04-10T10:15:00Z",
			ShippingStatus:           "delivered",
			ShippingStatusBadgeClass: "success",
			PaymentStatus:            "completed",
			PaymentStatusBadgeClass:  "success",
			TrackingId:               "1Z888BB20456789012",
			PaymentTransactionId:     "TXN-20260410-024",
			ShippedAt:                "2026-04-11T14:30:00Z",
			DeliveredAt:              "2026-04-13T16:45:00Z",
			StatusPlaced:             true,
			StatusProcessing:         true,
			StatusShipped:            true,
			StatusDelivered:          true,
			TotalCost: &pb.Money{CurrencyCode: "USD", Units: 129, Nanos: 950000000},
			SubtotalCost: &pb.Money{CurrencyCode: "USD", Units: 119, Nanos: 950000000},
			ShippingCost: &pb.Money{CurrencyCode: "USD", Units: 10, Nanos: 0},
			Items: []orderItemView{{Item: &pb.CartItem{ProductId: "66VCHSJNUP", Quantity: 1}, ProductName: "Vintage Camera", ItemPrice: &pb.Money{CurrencyCode: "USD", Units: 119, Nanos: 950000000}, ItemSubtotal: &pb.Money{CurrencyCode: "USD", Units: 119, Nanos: 950000000}}},
			ShippingAddress: &pb.Address{StreetAddress: "456 Oak Ave", City: "Seattle", State: "WA", Country: "US", ZipCode: 98101},
		},
	}

	// Generate 23 additional orders for pagination testing
	for i := 1; i <= 23; i++ {
		orderNum := 20 + i
		orderID := fmt.Sprintf("ORD-202604%02d-%03d", (9 + i) / 30, orderNum)

		statuses := []string{"placed", "processing", "shipped", "delivered"}
		statusIdx := i % 4
		status := statuses[statusIdx]

		statusClasses := map[string]string{
			"placed":      "secondary",
			"processing":  "info",
			"shipped":     "warning",
			"delivered":   "success",
		}

		products := []string{"2ZRWG08", "0PUK6V6EV0", "LS4PSXUNUM", "L9ECAV7KIM", "6E92ZMYYFZ"}
		productIdx := i % len(products)

		cities := []string{"New York", "Los Angeles", "Chicago", "Houston", "Phoenix"}
		states := []string{"NY", "CA", "IL", "TX", "AZ"}
		cityIdx := i % len(cities)

		order := orderView{
			OrderId:                  orderID,
			CreatedAt:                time.Now().AddDate(0, 0, -(9+i)).Format(time.RFC3339),
			ShippingStatus:           status,
			ShippingStatusBadgeClass: statusClasses[status],
			PaymentStatus:            "completed",
			PaymentStatusBadgeClass:  "success",
			PaymentTransactionId:     fmt.Sprintf("TXN-202604%02d-%03d", (9+i)/30, orderNum),
			StatusPlaced:             true,
			StatusProcessing:         statusIdx >= 1,
			StatusShipped:            statusIdx >= 2,
			StatusDelivered:          statusIdx >= 3,
			TotalCost: &pb.Money{CurrencyCode: "USD", Units: int64(50 + i*5), Nanos: 0},
			SubtotalCost: &pb.Money{CurrencyCode: "USD", Units: int64(45 + i*5), Nanos: 0},
			ShippingCost: &pb.Money{CurrencyCode: "USD", Units: 5, Nanos: 0},
			Items: []orderItemView{
				{
					Item: &pb.CartItem{ProductId: products[productIdx], Quantity: 1},
					ProductName: fmt.Sprintf("Product Item %d", i),
					ItemPrice: &pb.Money{CurrencyCode: "USD", Units: int64(45 + i*5), Nanos: 0},
					ItemSubtotal: &pb.Money{CurrencyCode: "USD", Units: int64(45 + i*5), Nanos: 0},
				},
			},
			ShippingAddress: &pb.Address{
				StreetAddress: fmt.Sprintf("%d Test Street", 100+i),
				City:          cities[cityIdx],
				State:         states[cityIdx],
				Country:       "US",
				ZipCode:       int32(10000 + i*100),
			},
		}
		orders = append(orders, order)
	}

	return orders
}

func (fe *frontendServer) viewOrdersListHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.Debug("viewing orders list")

	userID := sessionID(r)

	// Get orders (mock data for now)
	orders := fe.getMockOrders(userID)

	// Parse pagination
	pageStr := r.URL.Query().Get("page")
	page := 1
	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	pageSize := 20
	totalCount := len(orders)
	pageCount := (totalCount + pageSize - 1) / pageSize

	// Validate page
	if page > pageCount && pageCount > 0 {
		page = pageCount
	}

	// Get orders for current page
	startIdx := (page - 1) * pageSize
	endIdx := startIdx + pageSize
	if endIdx > totalCount {
		endIdx = totalCount
	}

	pageOrders := orders
	if startIdx < totalCount {
		pageOrders = orders[startIdx:endIdx]
	} else {
		pageOrders = []orderView{}
	}

	if err := templates.ExecuteTemplate(w, "orders-list", injectCommonTemplateData(r, map[string]interface{}{
		"orders":       pageOrders,
		"CurrentPage":  page,
		"PageCount":    pageCount,
		"TotalCount":   totalCount,
		"user_id":      userID,
	})); err != nil {
		log.WithError(err).Error("failed to execute orders-list template")
	}
}

func (fe *frontendServer) viewOrderDetailHandler(w http.ResponseWriter, r *http.Request) {
	log := r.Context().Value(ctxKeyLog{}).(logrus.FieldLogger)
	log.Debug("viewing order detail")

	vars := mux.Vars(r)
	orderID := vars["id"]
	userID := sessionID(r)

	if orderID == "" {
		renderHTTPError(log, r, w, errors.New("order ID is required"), http.StatusBadRequest)
		return
	}

	// Get order (mock data for now)
	orders := fe.getMockOrders(userID)
	var order *orderView
	for i := range orders {
		if orders[i].OrderId == orderID {
			order = &orders[i]
			break
		}
	}

	if order == nil {
		renderHTTPError(log, r, w, errors.New("order not found"), http.StatusNotFound)
		return
	}

	if err := templates.ExecuteTemplate(w, "order-detail", injectCommonTemplateData(r, map[string]interface{}{
		"order":   order,
		"user_id": userID,
	})); err != nil {
		log.WithError(err).Error("failed to execute order-detail template")
	}
}

// Template helper functions

func formatDate(dateStr string) string {
	if dateStr == "" {
		return ""
	}
	t, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		return dateStr
	}
	return t.Format("January 2, 2006")
}

func formatDateTime(dateStr string) string {
	if dateStr == "" {
		return ""
	}
	t, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		return dateStr
	}
	return t.Format("January 2, 2006 3:04 PM")
}

func formatOrderStatus(status string) string {
	statusMap := map[string]string{
		"placed":      "Order Placed",
		"processing":  "Processing",
		"shipped":     "Shipped",
		"delivered":   "Delivered",
		"failed":      "Failed",
		"cancelled":   "Cancelled",
	}
	if display, ok := statusMap[status]; ok {
		return display
	}
	return strings.Title(status)
}

func formatPaymentStatus(status string) string {
	statusMap := map[string]string{
		"placed":    "Pending",
		"completed": "Completed",
		"failed":    "Failed",
		"refunded":  "Refunded",
	}
	if display, ok := statusMap[status]; ok {
		return display
	}
	return strings.Title(status)
}

func seq(start, end int) []int {
	var result []int
	for i := start; i <= end; i++ {
		result = append(result, i)
	}
	return result
}
