defmodule CatatanBackendWeb.NotesValidator do
  import Ecto.Changeset
  alias CatatanBackendWeb.Error

  @doc """
  Validates the parameters for creating a note.
  Expects a map with optional :content key.
  """
  @spec validate_notes_creation(map) :: {:ok, map} | {:error, keyword()}
  def validate_notes_creation(params) do
    types = %{
      content: :string
    }

    {%{}, types}
    |> cast(params, Map.keys(types))
    |> validate_required([])
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end

  @spec validate_notes_update(map) :: {:ok, map} | {:error, keyword()}
  def validate_notes_update(params) do
    types = %{
      id: :string,
      content: :string
    }

    {%{}, types}
    |> cast(params, Map.keys(types))
    |> validate_required([:id])
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end
end
