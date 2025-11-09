defmodule CatatanBackendWeb.SessionsController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.Response
  alias CatatanBackendWeb.CookieSessionHelper
  alias CatatanBackend.Sessions
  alias CatatanBackend.Notes

  @moduledoc """
  Controller for managing user sessions.
  """

  action_fallback CatatanBackendWeb.FallbackController

  @doc """
  Lists all sessions for the current browser.
  """
  def index(conn, _params) do
    session_ids = CookieSessionHelper.get_session_ids(conn)
    active_session_id =
      case CookieSessionHelper.get_active_session_id(conn) do
        {:ok, id} -> id
        :error -> nil
      end

    # Get note_id for each session and fetch note details
    sessions_with_notes =
      Enum.reduce(session_ids, [], fn session_id, acc ->
        case Sessions.get_note_id(session_id) do
          {:ok, note_id} ->
            case Notes.get_note_by_id(note_id) do
              {:ok, note} ->
                session_data = %{
                  session_id: session_id,
                  note: note,
                  is_active: session_id == active_session_id
                }
                [session_data | acc]

              {:error, _} -> acc
            end

          {:error, _} -> acc
        end
      end)
      |> Enum.reverse()

    Response.success_response(conn, "Sessions retrieved successfully", %{
      sessions: sessions_with_notes,
      total: length(sessions_with_notes)
    })
  end

  @doc """
  Switches the active session to a different session.
  """
  def activate(conn, %{"id" => session_id}) do
    session_ids = CookieSessionHelper.get_session_ids(conn)

    cond do
      # Check if session exists in the array
      session_id not in session_ids ->
        conn
        |> put_status(:not_found)
        |> Response.error_response("Session not found in your sessions", %{})

      # Check if session exists in database
      true ->
        case Sessions.valid_session?(session_id) do
          {:ok, true} ->
            # Get the note to return in response
            case Sessions.get_note_id(session_id) do
              {:ok, note_id} ->
                case Notes.get_note_by_id(note_id) do
                  {:ok, note} ->
                    conn
                    |> CookieSessionHelper.set_active_session(session_id)
                    |> Response.success_response("Session activated successfully", %{
                      session_id: session_id,
                      note: note
                    })

                  {:error, :not_found} ->
                    conn
                    |> put_status(:not_found)
                    |> Response.error_response("Note not found", %{})
                end

              {:error, :not_found} ->
                conn
                |> put_status(:not_found)
                |> Response.error_response("Session not found", %{})
            end

          {:error, _} ->
            conn
            |> put_status(:not_found)
            |> Response.error_response("Invalid session", %{})
        end
    end
  end
end
