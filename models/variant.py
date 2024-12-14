from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship


class Variant(db.Model):
    __tablename__ = "variants"
    variant_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    variant_name = db.Column(db.String(120), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    stock = db.Column(db.Integer, nullable=True)
    unit = db.Column(db.String(120), nullable=False, server_default='kg')
    product_id = db.Column(db.Integer, ForeignKey('products.product_id'), nullable=False)
    
    product = relationship("Product", back_populates="variant", lazy=True)

    def __repr__(self):
        return f'<Variant {self.variant_id} {self.variant_name} {self.price} {self.stock} {self.product_id}>'
    
    def to_dict(self):
        return {
            'variant_id': self.variant_id,
            'variant_name': self.variant_name,
            'price': self.price,
            'stock': self.stock,
            'unit': self.unit,
            'product_id': self.product_id,
        }
    