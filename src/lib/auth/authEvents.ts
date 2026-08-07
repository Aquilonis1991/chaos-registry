/** AuthContext 廣播的登入/登出信號，供不屬於 auth session 本身生命週期的訂閱者（例如購買復原排程）使用，
 * 讓那些邏輯與 AuthContext 內部狀態解耦，不必塞進 auth context 內部。 */
export const AUTH_SIGNED_IN_EVENT = "votechaos-auth-signed-in";
export const AUTH_SIGNED_OUT_EVENT = "votechaos-auth-signed-out";
