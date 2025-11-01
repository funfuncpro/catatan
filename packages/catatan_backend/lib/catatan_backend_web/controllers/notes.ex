defmodule CatatanBackendWeb.NotesController do
  use CatatanBackendWeb, :controller

  def test_user(conn, _params) do
    case CatatanBackend.Notes.Create.test_user() do
      {:ok, notes} ->
        json(conn, %{status: "success", data: notes, message: "User created successfully"})

      {:error, reason} ->
        json(conn, %{status: "error", message: reason})
    end
  end

  def get_test_user(conn, _params) do
    case CatatanBackend.Notes.Create.get_test_user() do
      {:ok, users} ->
        json(conn, %{status: "success", data: users, message: "Users retrieved successfully"})

      {:error, reason} ->
        json(conn, %{status: "error", message: reason})
    end
  end

  def get_by_id(conn, %{"note_id" => note_id}) do
    case CatatanBackend.Notes.Get.get_by_id(note_id) do
      {:ok, note} ->
        json(conn, %{status: "success", data: note})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{status: "error", message: "Note not found"})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{status: "error", message: "Internal server error"})
    end
  end
end
