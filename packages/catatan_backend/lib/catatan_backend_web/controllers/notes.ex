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
end
