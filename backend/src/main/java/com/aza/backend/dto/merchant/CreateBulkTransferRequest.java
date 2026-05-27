package com.aza.backend.dto.merchant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreateBulkTransferRequest {

    private String note;

    @NotEmpty
    @Size(max = 100)
    @Valid
    private List<BulkTransferItemRequest> items;
}
