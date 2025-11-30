defmodule CatatanBackend.Notes.Crdt.Sync do
  alias CatatanBackend.Notes.Crdt.{Yata, StateVector, Element}

  @spec generate_delta(Yata.t(), StateVector.t()) :: [Element.t()]
  def generate_delta(%{elements: elements} = _yata, client_state_vector) do
    elements
    |> Map.values()
    |> Enum.reject(fn element ->
      {site_id, clock} = element.id
      StateVector.has_seen?(client_state_vector, site_id, clock)
    end)
  end
end
