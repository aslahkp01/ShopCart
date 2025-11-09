$(function () {
  $("#checkout-form").on("submit", function (e) {
    e.preventDefault();

    $.ajax({
      url: "/place-order",
      method: "POST",
      data: $(this).serialize(),
      success: function (response) {
        console.log("✅ Server response:", response);

        if (response.codSuccess) {
         window.location.href = "/order-success/" + response.orderId;
 // redirect to success page
        } else if (response.onlinePayment) {
          // TODO: integrate Razorpay/Stripe/etc.
          Swal.fire("Redirecting to payment...", "", "info");
        }
      },
      error: function () {
        Swal.fire("Order failed", "Please try again later.", "error");
      }
    });
  });
});
