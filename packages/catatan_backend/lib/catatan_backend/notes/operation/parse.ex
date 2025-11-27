defmodule CatatanBackend.Notes.Operation.Parse do
  alias CatatanBackend.Notes.Operation

  @spec parse(%{
          ot: String.t(),
          data: String.t() | nil,
          index: %{
            start: integer(),
            end: integer()
          }
        }) :: {:ok, Operation.t()} | {:error, :invalid_operation}

  def parse(%{ot: nil}), do: {:error, :invalid_operation}
  def parse(%{ot: ""}), do: {:error, :invalid_operation}

  def parse(%{ot: "is", data: nil}), do: {:error, :invalid_operation}
  def parse(%{ot: "is", data: ""}), do: {:error, :invalid_operation}

  def parse(%{ot: "is", data: data, index: index}) do
    end_idx = Map.get(index, :end, Map.get(index, :start, 0) + String.length(data))
    start_idx = Map.get(index, :start, 0)

    {:ok,
     %Operation{
       operation: :insert,
       data: data,
       index: %{start: start_idx, end: end_idx}
     }}
  end

  def parse(%{ot: "rs", data: nil, index: %{end: _} = index}) do
    start_idx = Map.get(index, :start, 0)
    end_idx = Map.get(index, :end)

    {:ok,
     %Operation{
       operation: :remove,
       data: nil,
       index: %{start: start_idx, end: end_idx}
     }}
  end

  def parse(%{ot: "rs", data: nil}), do: {:error, :invalid_operation}

  def parse(%{ot: "rs", data: data, index: index}) when is_binary(data) do
    start_idx = Map.get(index, :start, 0)
    end_idx = Map.get(index, :end, start_idx + String.length(data))

    {:ok,
     %Operation{
       operation: :remove,
       data: data,
       index: %{start: start_idx, end: end_idx}
     }}
  end

  def parse(_), do: {:error, :invalid_operation}
end
