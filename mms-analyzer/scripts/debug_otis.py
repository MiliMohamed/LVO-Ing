# -*- coding: utf-8 -*-
import pandas as pd
from pathlib import Path

p = Path(r"c:\Users\Mili\Downloads\Q1 SCI CADJEE.xls")
xl = pd.ExcelFile(p, engine="xlrd")
print("sheets:", xl.sheet_names)
di = pd.read_excel(p, sheet_name=0, header=0, engine="xlrd")
print("interventions", len(di))
print("cols:", list(di.columns))
print("ascenseurs:", sorted(di.iloc[:, 0].dropna().astype(str).unique()))
om = pd.read_excel(p, sheet_name=1, header=0, engine="xlrd")
print("maint", len(om), "groups", om.groupby([om.columns[0], om.columns[4]]).ngroups)
aa = pd.read_excel(p, sheet_name=2, header=0, engine="xlrd")
print("arret", len(aa), aa.columns.tolist())
