import SwiftUI
import WidgetKit

@main
struct AzaComplicationBundle: WidgetBundle {
    var body: some Widget {
        BalanceComplication()
        BudgetComplication()
        AttentionComplication()
    }
}
