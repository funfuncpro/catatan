defmodule CatatanBackendWeb.NotesValidator do
  import Ecto.Changeset
  alias CatatanBackendWeb.Error

  @doc """
  Validates the parameters for creating a note.
  Expects a map with :content keys, both as strings.
  """
  @spec validate_notes_creation(map) :: {:ok, map} | {:error, keyword()}
  def validate_notes_creation(params) do
    types = %{
      content: :string
    }

    {%{}, types}
    |> cast(params, Map.keys(types))
    |> validate_required([:content])
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end
end
