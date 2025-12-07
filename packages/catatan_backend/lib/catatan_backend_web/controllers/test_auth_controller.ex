defmodule CatatanBackendWeb.TestAuthController do
  use CatatanBackendWeb, :controller
  require Logger

  def show(conn, _params) do
    user = conn.assigns.current_user

    Logger.info("""
    ========================================
    PROTECTED ROUTE TEST - User Credentials
    ========================================
    User ID: #{user.user_id}
    Email: #{user.email}
    External ID: #{user.external_id}
    ========================================
    """)

    json(conn, %{
      success: true,
      message: "Authentication working! Check server logs for user details.",
      user: %{
        user_id: user.user_id,
        email: user.email,
        external_id: user.external_id
      }
    })
  end
end
