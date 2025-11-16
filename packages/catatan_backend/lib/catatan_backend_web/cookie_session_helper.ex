defmodule CatatanBackendWeb.CookieSessionHelper do
  @moduledoc """
  Helper module for managing multiple sessions in cookies.

  - Storing array of session_ids
  - Managing active session
  - Adding/removing sessions from the array
  """

  @sessions_cookie_name "session_ids"
  @active_session_cookie_name "active_session"
  # 30 days
  @cookie_max_age 30 * 24 * 60 * 60

  @doc """
  Retrieves the list of session IDs from cookies.

  Returns a list of session IDs or an empty list if none exist.
  """
  @spec get_session_ids(Plug.Conn.t()) :: [String.t()]
  def get_session_ids(conn) do
    case Map.get(conn.cookies, @sessions_cookie_name) do
      nil ->
        []

      "" ->
        []

      sessions_json ->
        case Jason.decode(sessions_json) do
          {:ok, sessions} when is_list(sessions) -> sessions
          _ -> []
        end
    end
  end

  @doc """
  Gets the active session ID from cookies.
  """
  @spec get_active_session_id(Plug.Conn.t()) :: {:ok, String.t()} | :error
  def get_active_session_id(conn) do
    case Map.get(conn.cookies, @active_session_cookie_name) do
      nil -> :error
      "" -> :error
      session_id -> {:ok, session_id}
    end
  end

  @doc """
  Adds a new session ID to the sessions array and sets it as active.
  """
  @spec add_and_activate_session(Plug.Conn.t(), String.t()) :: Plug.Conn.t()
  def add_and_activate_session(conn, session_id) do
    # Get existing sessions
    existing_sessions = get_session_ids(conn)

    # Add new session if not already in list
    updated_sessions =
      if session_id in existing_sessions do
        existing_sessions
      else
        [session_id | existing_sessions]
      end

    # Encode to JSON
    sessions_json = Jason.encode!(updated_sessions)

    # Set both cookies
    conn
    |> Plug.Conn.put_resp_cookie(@sessions_cookie_name, sessions_json,
      http_only: true,
      secure: Application.get_env(:catatan_backend, :env) == :prod,
      same_site: "Lax",
      max_age: @cookie_max_age
    )
    |> Plug.Conn.put_resp_cookie(@active_session_cookie_name, session_id,
      http_only: true,
      secure: Application.get_env(:catatan_backend, :env) == :prod,
      same_site: "Lax",
      max_age: @cookie_max_age
    )
  end

  @doc """
  Sets the active session without modifying the sessions array.
  """
  @spec set_active_session(Plug.Conn.t(), String.t()) :: Plug.Conn.t()
  def set_active_session(conn, session_id) do
    # Verify session exists in the array
    sessions = get_session_ids(conn)

    if session_id in sessions do
      Plug.Conn.put_resp_cookie(conn, @active_session_cookie_name, session_id,
        http_only: true,
        secure: Application.get_env(:catatan_backend, :env) == :prod,
        same_site: "Lax",
        max_age: @cookie_max_age
      )
    else
      conn
    end
  end

  @doc """
  Removes a session from the array.
  """
  @spec remove_session(Plug.Conn.t(), String.t()) :: Plug.Conn.t()
  def remove_session(conn, session_id) do
    existing_sessions = get_session_ids(conn)
    updated_sessions = List.delete(existing_sessions, session_id)

    sessions_json = Jason.encode!(updated_sessions)

    conn
    |> Plug.Conn.put_resp_cookie(@sessions_cookie_name, sessions_json,
      http_only: true,
      secure: Application.get_env(:catatan_backend, :env) == :prod,
      same_site: "Lax",
      max_age: @cookie_max_age
    )
  end
end
