defmodule CatatanBackend.Notes.Crdt.Sync do
  alias CatatanBackend.Notes.Crdt.{Yata, StateVector, Element}

  @spec generate_delta(Yata.t(), StateVector.t()) :: [Element.t()]
  def generate_delta(%{elements: elements} = _yata, client_state_vector) do
    elements
    |> Map.values()
    |> Enum.reject(fn element ->
      {writer_id, clock} = element.id
      StateVector.has_seen?(client_state_vector, writer_id, clock)
    end)
  end

  @spec apply_delta(Yata.t(), [Element.t()]) :: Yata.t()
  def apply_delta(%Yata{} = yata, elements) do
    Enum.reduce(elements, yata, &Yata.integrate(&2, &1))
  end
end
