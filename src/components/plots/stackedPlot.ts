///<reference path="../../reference.ts" />

module Plottable {
export module Abstract {
  export class Stacked<X, Y> extends Abstract.NewStylePlot<X, Y> {
    private stackedExtent = [0, 0];
    public _isVertical: boolean;

    public _onDatasetUpdate() {
      super._onDatasetUpdate();
      // HACKHACK Caused since onDataSource is called before projectors are set up.  Should be fixed by #803
      if (this._datasetKeysInOrder && this._projectors["x"]  && this._projectors["y"]) {
        this.stack();
      }
    }

    private stack() {
      var datasets = this._getDatasetsInOrder();
      var keyAccessor = this._isVertical ? this._projectors["x"].accessor : this._projectors["y"].accessor;
      var valueAccessor = this._isVertical ? this._projectors["y"].accessor : this._projectors["x"].accessor;

      var positiveValuedDatasets: any[][] = [];
      var negativeValuedDatasets: any[][] = [];

      datasets.forEach((dataset) => {
        var positiveValuedDataset: any[] = [];
        var negativeValuedDataset: any[] = [];

        dataset.data().forEach((datum) => {
          var key = keyAccessor(datum);
          var value = valueAccessor(datum);

          var positiveValue = value >= 0 ? value : 0;
          positiveValuedDataset.push({key: key, value: positiveValue});

          var negativeValue = value <= 0 ? value : 0;
          negativeValuedDataset.push({key: key, value: negativeValue});
        });

        positiveValuedDatasets.push(positiveValuedDataset);
        negativeValuedDatasets.push(negativeValuedDataset);
      });

      this.setDatasetStackOffsets(this._stack(positiveValuedDatasets), this._stack(negativeValuedDatasets));

      var maxY = _Util.Methods.max(datasets, (dataset: any) => {
        return _Util.Methods.max(dataset.data(), (datum: any) => {
          return valueAccessor(datum) + datum["_PLOTTABLE_PROTECTED_FIELD_STACK_OFFSET"];
        });
      });
      this.stackedExtent[1] = Math.max(0, maxY);

      var minY = _Util.Methods.min(datasets, (dataset: any) => {
        return _Util.Methods.min(dataset.data(), (datum: any) => {
          return valueAccessor(datum) + datum["_PLOTTABLE_PROTECTED_FIELD_STACK_OFFSET"];
        });
      });
      this.stackedExtent[0] = Math.min(minY, 0);
    }

    /**
     * Feeds the data through d3's stack layout function which will calculate
     * the stack offsets and use the the function declared in .out to set the offsets on the data.
     */
    private _stack(data: any[]): any[] {
      var outFunction = (d: any, y0: number, y: number) => {
        d.stackOffset = y0;
      };

      d3.layout.stack()
               .x((d) => d.key)
               .y((d) => d.value)
               .values((d) => d)
               .out(outFunction)(data);

      return data;
    }

    /**
     * After the stack offsets have been determined on each separate dataset, the offsets need
     * to be determined correctly on the overall datasets
     */
    private setDatasetStackOffsets(positiveDatasets: any[], negativeDatasets: any[]) {
      this._getDatasetsInOrder().forEach((dataset, datasetIndex) => {
        var valueAccessor = this._isVertical ? this._projectors["y"].accessor : this._projectors["x"].accessor;
        dataset.data().forEach((datum: any, datumIndex: number) => {
          var positiveOffset = positiveDatasets[datasetIndex][datumIndex]["stackOffset"];
          var negativeOffset = negativeDatasets[datasetIndex][datumIndex]["stackOffset"];
          datum["_PLOTTABLE_PROTECTED_FIELD_STACK_OFFSET"] = valueAccessor(datum) >= 0 ? positiveOffset : negativeOffset;
        });
      });
    }

    public _updateScaleExtents() {
      super._updateScaleExtents();
      var primaryScale: Abstract.Scale<any,number> = this._isVertical ? this._yScale : this._xScale;
      if (!primaryScale) {
        return;
      }
      if (this._isAnchored && this.stackedExtent.length > 0) {
        primaryScale._updateExtent(this._plottableID.toString(), "_PLOTTABLE_PROTECTED_FIELD_STACK_EXTENT", this.stackedExtent);
      } else {
        primaryScale._removeExtent(this._plottableID.toString(), "_PLOTTABLE_PROTECTED_FIELD_STACK_EXTENT");
      }
    }
  }
}
}
