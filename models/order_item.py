from connector.db import db
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, func
from sqlalchemy.orm import relationship


class OrderItem(db.Model):
    __tablename__ = 'orderitem'
    orderitem_id= db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    order_id= db.Column(db.Integer, ForeignKey('orders.order_id'), nullable=False)
    product_id= db.Column(db.Integer, ForeignKey('products.product_id'), nullable=False)
    quantity= db.Column(db.Integer, nullable=False)
    unit_price= db.Column(db.Integer, nullable=False)
    total_price= db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="order_item", lazy=True)

    product = relationship("Product", back_populates="order_item", lazy=True)

    def __repr__(self):
        return f'<OrderItem {self.orderitem_id} {self.order_id} {self.product_id} {self.quantity} {self.unit_price} {self.total_price} {self.created_at}'
    

    def to_dict(self):
        return {
            'orderitem_id': self.orderitem_id,
            'order_id': self.order_id,
            'product_id': self.product_id,
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'total_price': self.total_price,
            'created_at': self.created_at
        }

