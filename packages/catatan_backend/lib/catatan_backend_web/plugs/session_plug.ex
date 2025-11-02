defmodule CatatanBackendWeb.Plugs.SessionPlug do
  @moduledoc """
  Plug for managing session cookies.

  This plug reads the session_id from cookies and validates it against the database.
  If the session is valid, it stores the session_id in conn.assigns for use in controllers.
  """

  import Plug.Conn
  alias CatatanBackend.Sessions

  @doc """
  Initializes the plug.
  """
  def init(opts), do: opts

  @doc """
  Main plug logic to read and validate session cookies.

  Reads the session_id cookie and validates it exists in the database.
  If valid, stores it in conn.assigns[:session_id].
  If invalid or missing, does nothing (allows anonymous access).
  """
  def call(conn, _opts) do
    case get_session_id_from_cookie(conn) do
      {:ok, session_id} ->
        # Validate session exists in database
        case Sessions.valid_session?(session_id) do
          {:ok, true} ->
            # Session is valid, store in assigns
            assign(conn, :session_id, session_id)

          {:error, _reason} ->
            # Session not found in database, treat as no session
            conn
        end

      :error ->
        # No session cookie, treat as anonymous
        conn
    end
  end

  defp get_session_id_from_cookie(conn) do
    case Map.get(conn.cookies, "session_id") do
      nil -> :error
      "" -> :error
      session_id -> {:ok, session_id}
    end
  end
end
