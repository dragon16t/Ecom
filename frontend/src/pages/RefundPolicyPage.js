import React from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { ChevronLeft, RefreshCw, CheckCircle, Clock, AlertCircle, HelpCircle } from 'lucide-react';

function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Refund & Return Policy</h1>
              <p className="text-sm text-gray-500">Last updated: April 2026</p>
            </div>
          </div>

          {/* 30-Day Guarantee Banner */}
          <div className="bg-gradient-to-r from-green-50 to-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">30-Day Money Back Guarantee</p>
                <p className="text-sm text-green-700">Not satisfied? Get a full refund, no questions asked.</p>
              </div>
            </div>
          </div>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">1. Our Promise</h2>
            <p className="text-gray-600 mb-4">
              At Celesta Glow, customer satisfaction is our top priority. We offer a hassle-free 30-day return and refund policy on all our products. If you're not completely satisfied with your purchase, we'll make it right.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">2. Eligibility for Returns</h2>
            <p className="text-gray-600 mb-2">You can request a return if:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>The product is within 30 days of delivery</li>
              <li>The product is unused or minimally used (up to 25% used)</li>
              <li>You received a damaged or defective product</li>
              <li>You received the wrong product</li>
              <li>The product caused an adverse skin reaction (with proof)</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">3. Non-Returnable Items</h2>
            <p className="text-gray-600 mb-2">The following are not eligible for return:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Products used more than 25%</li>
              <li>Products without original packaging</li>
              <li>Returns requested after 30 days of delivery</li>
              <li>Free gifts or promotional items</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">4. How to Request a Return</h2>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                  <p className="text-gray-700">Contact us via WhatsApp at <a href="https://wa.me/919446125745" className="text-green-600 font-medium">+91 94461 25745</a> or email <a href="mailto:support@celestaglow.com" className="text-green-600 font-medium">support@celestaglow.com</a></p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                  <p className="text-gray-700">Provide your order ID and reason for return</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                  <p className="text-gray-700">Our team will arrange a reverse pickup within 3-5 business days</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
                  <p className="text-gray-700">Refund will be processed within 7-10 business days after receiving the product</p>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">5. Refund Process</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">Prepaid Orders</span>
                </div>
                <p className="text-sm text-gray-600">Refund to original payment method within 7-10 business days</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-gray-900">COD Orders</span>
                </div>
                <p className="text-sm text-gray-600">Refund via bank transfer or UPI within 7-10 business days</p>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">6. Damaged or Defective Products</h2>
            <p className="text-gray-600 mb-4">
              If you receive a damaged or defective product, please contact us within 48 hours of delivery with photos of the product and packaging. We will arrange a free replacement or full refund immediately.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">7. Cancellation Policy</h2>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li><strong>Before Shipping:</strong> Full refund within 24 hours</li>
              <li><strong>After Shipping:</strong> Product will be delivered; you can then request a return</li>
              <li><strong>Prepaid Orders:</strong> ₹29 COD advance is non-refundable if order is cancelled after shipping</li>
            </ul>

            <div className="mt-8 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-800">Need Help?</p>
                  <p className="text-sm text-yellow-700">
                    For any refund-related queries, reach out to us on WhatsApp: <a href="https://wa.me/919446125745" className="font-medium underline">+91 94461 25745</a> or email: <a href="mailto:support@celestaglow.com" className="font-medium underline">support@celestaglow.com</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RefundPolicyPage;
