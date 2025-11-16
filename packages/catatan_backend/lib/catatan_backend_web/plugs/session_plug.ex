defmodule CatatanBackendWeb.Plugs.SessionPlug do
  @moduledoc """
  Plug for managing session cookies.

  This plug reads the active_session from cookies and validates it against the database.
  It also validates that the active session exists in the sessions array.
  If the session is valid, it stores the session_id in conn.assigns for use in controllers.
  """

  import Plug.Conn
  alias CatatanBackend.Sessions
  alias CatatanBackendWeb.CookieSessionHelper

  @doc """
  Initializes the plug.
  """
  def init(opts), do: opts

  @spec call(Plug.Conn.t(), any()) :: Plug.Conn.t()
  @doc """
  Main plug logic to read and validate session cookies.
  """
  def call(conn, _opts) do
    with {:ok, active_session_id} <- CookieSessionHelper.get_active_session_id(conn),
         session_ids <- CookieSessionHelper.get_session_ids(conn),
         true <- active_session_id in session_ids,
         {:ok, true} <- Sessions.valid_session?(active_session_id) do
      # Session is valid, store in assigns
      assign(conn, :session_id, active_session_id)
    else
      _ ->
        # No valid session, treat as anonymous
        conn
    end
  end
end
