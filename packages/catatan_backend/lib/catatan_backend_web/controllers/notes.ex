defmodule CatatanBackendWeb.NotesController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.NotesValidator
  alias CatatanBackendWeb.Response
  alias CatatanBackendWeb.CookieSessionHelper
  alias CatatanBackend.Notes

  action_fallback CatatanBackendWeb.FallbackController

  @moduledoc """
  Controller for handling note-related API requests.
  """

  def create(conn, params) do
    case NotesValidator.validate_notes_creation(params) do
      {:ok, validated_data} ->
        case Notes.create_note(Map.get(validated_data, :content, "")) do
          {:ok, note} ->
            case CatatanBackend.Sessions.create_session(note["note_id"]) do
              {:ok, session} ->
                conn
                |> CookieSessionHelper.add_and_activate_session(session["session_id"])
                |> put_status(:created)
                |> Response.success_response("Note created successfully", note)

              {:error, _reason} ->
                conn
                |> put_status(:internal_server_error)
                |> Response.error_response("Failed to create session", %{})
            end

          {:error, _reason} ->
            conn
            |> put_status(:internal_server_error)
            |> Response.error_response("Failed to create note", %{})
        end

      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)
    end
  end

  def update(conn, params) do
    IO.inspect(params)

    case NotesValidator.validate_notes_update(params) do
      {:ok, validated_data} ->
        with {:ok, note} <-
               Notes.update_note_by_id(validated_data.id, Map.get(validated_data, :content, "")) do
          conn
          |> put_status(:ok)
          |> Response.success_response("Note updated successfully", note)
        end

      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)
    end
  end

  @doc """
  Handles the API request to retrieve all notes.
  """
  def index(conn, _params) do
    case Notes.list_notes() do
      {:ok, notes} ->
        Response.success_response(conn, "success", %{notes: notes})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> Response.error_response("internal server error", %{})
    end
  end

  @doc """
  Handles the API request to retrieve a single note by its ID.
  """
  def show(conn, %{"id" => note_id}) do
    case Notes.get_note_by_id(note_id) do
      {:ok, note} ->
        Response.success_response(conn, "success", note)

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> Response.error_response("not found", %{})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> Response.error_response("internal server error", %{})
    end
  end
end
